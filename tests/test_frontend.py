"""Browser regression tests. API responses are mocks; vendor libraries are real."""
import base64
import functools
import json
import os
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import unittest
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

class FrontendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.origin = f'http://127.0.0.1:{cls.server.server_port}'
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(channel=os.environ.get("BROWSER_CHANNEL") or None)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1440, 'height': 1000}, timezone_id='Pacific/Auckland', reduced_motion='reduce')
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.requests = []
        self.responses = {'galeria': [], 'memorias': [], 'encontros': [], 'roteiros': [], 'configuracoes': []}
        self.page.route('**/api/*', self.mock_api)
        self.page.route('**/js/config.js', lambda route: route.fulfill(content_type='application/javascript', body=re.sub(r'API_BASE_URL: "[^"\n]*"', f'API_BASE_URL: "{self.origin}"', (ROOT/'js/config.js').read_text(encoding='utf-8'))))
        # Map tiles are mocked to avoid requests to a public tile service in tests.
        self.page.route('**/*.tile.openstreetmap.org/**', lambda route: route.fulfill(content_type='image/png', body=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')))

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [], 'Uncaught browser errors')

    def mock_api(self, route):
        name = route.request.url.split('?', 1)[0].rstrip('/').rsplit('/', 1)[-1]
        self.requests.append((name, route.request))
        if name in ('galeria', 'memorias') and route.request.method == 'DELETE':
            value = self.responses.get(f'{name}_delete', (200, {'success': True, 'deleted': True}))
            if isinstance(value, tuple) and value[0] == 200 and value[1].get('deleted') is True:
                target_id = route.request.url.split('id=', 1)[1].split('&', 1)[0] if name == 'galeria' else route.request.post_data_json.get('id')
                self.responses[name] = [row for row in self.responses.get(name, []) if str(row.get('id')) != str(target_id)]
        elif name == 'memorias' and route.request.method == 'POST':
            body = route.request.post_data_json
            value = self.responses.get('memorias_create', (201, body))
            if isinstance(value, tuple) and value[0] == 201:
                self.responses['memorias'] = [body]
        elif name == 'encontros' and route.request.method == 'POST':
            body = route.request.post_data_json
            etapa_data = [{
                'ordem': item['ordem'], 'nome': item['nome'], 'horario': item['horario'],
                'descricao': item['descricao'], 'busca': item['endereco'] or item['nome'],
                'endereco_sugerido': item['endereco'] or item['nome'],
                'tipo_atividade': body['tipo_passeio'], 'custo_estimado': None,
            } for item in body['etapas']]
            dados = {
                'titulo': body['titulo'], 'descricao': body['descricao'], 'resumo': body['descricao'],
                'cidade': body['cidade'], 'data': body['data_encontro'], 'inicio': body['horario_inicio'],
                'fim': body['horario_fim'], 'chuva': '', 'plano_alternativo_chuva': '', 'alimentacao': '',
                'custos': '', 'observacoes': 'Cronograma manual.', 'recomendacoes': [],
                'tipo_passeio': body['tipo_passeio'], 'transporte': body['transporte'], 'etapas': etapa_data,
            }
            meeting = {
                'id': 'created-meeting', 'titulo': body['titulo'], 'data_encontro': body['data_encontro'],
                'horario_inicio': body['horario_inicio'], 'horario_fim': body['horario_fim'],
                'cidade': body['cidade'], 'local': body['etapas'][0]['nome'],
                'endereco': body['etapas'][0]['endereco'], 'descricao': body['descricao'],
                'status': 'Planejado',
            }
            itinerary = {'id': 'created-itinerary', 'encontro_id': meeting['id'], 'titulo': body['titulo'], 'dados_json': dados}
            value = self.responses.get('encontros_create', (201, {'success': True, 'encontro': meeting, 'roteiro': itinerary}))
            if isinstance(value, tuple) and value[0] == 201:
                self.responses['encontros'] = [*self.responses.get('encontros', []), meeting]
                self.responses['roteiros'] = [*self.responses.get('roteiros', []), itinerary]
        else:
            value = self.responses.get(name, [])
        if isinstance(value, tuple):
            route.fulfill(status=value[0], content_type='application/json', body=json.dumps(value[1]))
        else:
            route.fulfill(content_type='application/json', body=json.dumps(value))

    def open(self):
        self.page.goto(self.origin)
        expect(self.page.locator('#gallery-grid')).to_have_attribute('aria-busy', 'false')

    def itinerary(self):
        return {'titulo': 'Passeio de teste', 'cidade': 'Cidade de teste', 'inicio': '09:00', 'fim': '11:00',
                'etapas': [{'nome': 'Parada de teste', 'horario': '09:00', 'descricao': 'Descrição de teste', 'busca': 'Endereço de teste'}]}

    def fill_planner(self):
        self.page.locator('[name=data]').fill(self.page.locator('[name=data]').get_attribute('min'))

    def test_static_assets_imports_and_no_login(self):
        import re
        html = (ROOT/'index.html').read_text(encoding='utf-8')
        for url in re.findall(r'(?:src|href)="(/[^"#]+)"', html):
            if url == '/assets/audio/nossa-musica.mp3' and not (ROOT/'assets/audio/nossa-musica.mp3').is_file():
                # This is the user's media file; the player has a graceful missing-file state.
                continue
            self.assertTrue((ROOT/url.lstrip('/')).is_file(), url)
        for file in (ROOT/'js').rglob('*.js'):
            for target in re.findall(r'from\s+"(\.[^"]+)"', file.read_text(encoding='utf-8')):
                self.assertTrue((file.parent/target).is_file(), f'{file}: {target}')
        self.assertFalse((ROOT/'admin.html').exists())
        self.assertNotIn('/admin', html)
        self.open()
        self.assertEqual(self.page.locator('input[type=password]').count(), 1)
        self.assertEqual(self.page.locator('#admin-capability-token').count(), 1)
        self.assertTrue(all('admin' not in name for name, _ in self.requests))

    def test_gallery_upload_modal_preview_validation_and_publish_refresh(self):
        self.open()
        expect(self.page.locator('#gallery-add-photo')).to_contain_text('Adicionar foto ♡')
        self.page.locator('#gallery-add-photo').click()
        expect(self.page.locator('#gallery-upload-dialog')).to_be_visible()
        self.page.keyboard.press('Escape')
        expect(self.page.locator('#gallery-upload-dialog')).not_to_be_visible()
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.locator('#gallery-add-photo').click()
        bounds = self.page.locator('#gallery-upload-dialog').bounding_box()
        self.assertGreaterEqual(bounds['x'], 0)
        self.assertLessEqual(bounds['x'] + bounds['width'], 390)
        self.page.locator('#upload-file').set_input_files({
            'name': 'foto.png', 'mimeType': 'image/png',
            'buffer': base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')
        })
        expect(self.page.locator('#upload-preview-wrap')).to_be_visible()
        expect(self.page.locator('#upload-preview')).to_have_attribute('src', re.compile('^blob:'))
        self.page.locator('[name=legenda]').fill('Nosso passeio')
        self.page.locator('#upload-submit').click()
        expect(self.page.locator('#gallery-upload-feedback')).to_contain_text('Fotografia publicada com carinho!')
        upload = [request for name, request in self.requests if name == 'galeria' and request.method == 'POST']
        self.assertEqual(len(upload), 1)
        self.assertRegex(upload[0].headers['content-type'], r'^multipart/form-data; boundary=')
        multipart = upload[0].post_data_buffer.decode('latin1')
        self.assertIn('name="file"', multipart)
        self.assertIn('name="legenda"', multipart)
        self.assertIn('Nosso passeio', multipart)
        self.assertIn('name="data_foto"', multipart)
        self.assertEqual(sum(1 for name, request in self.requests if name == 'galeria' and request.method == 'GET'), 2)

    def test_gallery_upload_rejects_type_and_size_and_handles_api_error(self):
        self.open()
        self.page.locator('#gallery-add-photo').click()
        self.page.locator('#upload-file').set_input_files({'name': 'arquivo.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF'})
        expect(self.page.locator('#upload-status')).to_contain_text('JPEG, PNG ou WebP')
        self.page.locator('#upload-file').set_input_files({'name': 'grande.png', 'mimeType': 'image/png', 'buffer': b'x' * (3 * 1024 * 1024)})
        expect(self.page.locator('#upload-status')).to_contain_text('até 2,8 MB')
        self.page.locator('#upload-cancel').click()
        self.responses['galeria'] = (503, {'error': 'indisponível'})
        self.page.locator('#gallery-add-photo').click()
        self.page.locator('#upload-file').set_input_files({'name': 'foto.png', 'mimeType': 'image/png', 'buffer': base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')})
        self.page.locator('[name=legenda]').fill('Tente novamente')
        self.page.locator('#upload-submit').click()
        expect(self.page.locator('#upload-status')).to_contain_text('temporariamente indisponível')
        expect(self.page.locator('#gallery-upload-dialog')).to_be_visible()

    def test_settings_array_updates_all_branding_and_rerenders(self):
        self.responses['configuracoes'] = [{
            'nome_site': 'Nosso Universo', 'nome_pessoa_1': 'Pessoa A',
            'nome_pessoa_2': 'Pessoa B', 'mensagem_principal': '<b>Uma mensagem nossa</b>',
            'data_inicio_relacionamento': '2020-01-01', 'imagem_capa': ''
        }, {'nome_site': 'Nao usar'}]
        self.open()
        expect(self.page.locator('#site-config')).to_have_attribute('aria-busy', 'false')
        expect(self.page).to_have_title('Nosso Universo — Pessoa A & Pessoa B')
        expect(self.page.locator('#hero-message')).to_have_text('<b>Uma mensagem nossa</b>')
        self.assertEqual(self.page.locator('#hero-message b').count(), 0)
        expect(self.page.locator('#couple-names')).to_have_text('Pessoa A & Pessoa B')
        for node in self.page.locator('[data-site-name]').all():
            expect(node).to_have_text('Nosso Universo')
        for node in self.page.locator('[data-couple-names]').all():
            expect(node).to_have_text('Pessoa A & Pessoa B')
        expect(self.page.locator('#together')).to_be_visible()
        expect(self.page.locator('#config-status')).to_be_empty()
        self.responses['ai'] = self.itinerary()
        self.fill_planner()
        self.page.locator('#planner-form button[type=submit]').click()
        expect(self.page.locator('.itinerary-title h3')).to_have_text('Passeio de teste')
        expect(self.page.locator('.itinerary-title [data-site-name]')).to_have_text('Nosso Universo')

    def test_settings_error_invalid_contract_and_retry(self):
        self.responses['configuracoes'] = {'nome_site': 'Objeto invalido'}
        self.open()
        expect(self.page.locator('#config-status')).to_contain_text('formato inesperado')
        expect(self.page.locator('#site-config')).to_have_attribute('aria-busy', 'false')
        expect(self.page).to_have_title('My Bae — Jorge & Maria')
        self.responses['configuracoes'] = [{'nome_site': 123}]
        self.page.locator('#config-status .retry').click()
        expect(self.page.locator('#config-status')).to_contain_text('incompletos ou inválidos')
        self.responses['configuracoes'] = [{'nome_site': 'Conectado', 'nome_pessoa_1': None}]
        self.page.locator('#config-status .retry').click()
        expect(self.page).to_have_title('Conectado — Jorge & Maria')
        expect(self.page.locator('#config-status')).to_be_empty()

    def test_settings_loading_and_http_failure(self):
        self.page.route('**/api/configuracoes', lambda route: route.fulfill(
            status=503, content_type='application/json', body='{}'))
        self.open()
        expect(self.page.locator('#config-status')).to_contain_text('temporariamente indisponível')
        expect(self.page.locator('#config-status .retry')).to_be_visible()
        self.assertTrue(self.page.locator('.hero-art').is_visible())

    def test_settings_loading_and_empty_array(self):
        pending = []
        self.page.route('**/api/configuracoes', lambda route: pending.append(route))
        self.page.goto(self.origin, wait_until='domcontentloaded')
        expect(self.page.locator('#site-config')).to_have_attribute('aria-busy', 'true')
        expect(self.page.locator('#config-status')).to_contain_text('Carregando')
        self.assertEqual(len(pending), 1)
        pending[0].fulfill(content_type='application/json', body='[]')
        expect(self.page.locator('#site-config')).to_have_attribute('aria-busy', 'false')
        expect(self.page.locator('#config-status')).to_contain_text('primeiros detalhes')
        expect(self.page).to_have_title('My Bae — Jorge & Maria')

    def test_disconnected_backend(self):
        self.page.unroute('**/js/config.js')
        self.page.route('**/js/config.js', lambda route: route.fulfill(content_type='application/javascript', body=re.sub(r'API_BASE_URL: "[^"\n]*"', 'API_BASE_URL: ""', (ROOT/'js/config.js').read_text(encoding='utf-8'))))
        self.open()
        expect(self.page.locator('#gallery-grid')).to_contain_text('serviço da galeria está indisponível')
        self.assertEqual(self.requests, [])
        expect(self.page.locator('#together')).to_be_hidden()

    def test_gallery_memories_lightbox_and_safe_images(self):
        self.responses['galeria'] = [
            {'imagem_url': '/assets/images/flowers.jpg', 'legenda': '<script>teste</script>', 'data_foto': '2026-10-01'},
            {'imagem_url': '/assets/images/park.jpg'},
            {'imagem_url': 'https://project.supabase.co/storage/v1/object/sign/private/photo.jpg?token=private', 'legenda': 'ZZZ'},
        ]
        self.responses['memorias'] = [{'titulo': '<b>Memória</b>', 'data_memoria': '2026-10-01'}]
        self.open()
        expect(self.page.locator('.photo-card')).to_have_count(3)
        expect(self.page.locator('.memory-card')).to_contain_text('<b>Memória</b>')
        self.assertEqual(self.page.locator('.memory-card b').count(), 0)
        self.page.locator('#gallery-sort').select_option('caption')
        self.page.locator('.photo-card').first.click()
        expect(self.page.locator('#lightbox')).to_be_visible()
        self.page.keyboard.press('ArrowRight')
        expect(self.page.locator('#lightbox-caption')).to_contain_text('<script>teste</script>')
        self.page.keyboard.press('Escape')
        expect(self.page.locator('#lightbox')).not_to_be_visible()
        expect(self.page.locator('.photo-card').first).to_be_focused()

    def test_admin_delete_capabilities_confirmation_cancel_success_and_refresh(self):
        photo_id = 'a9caaf82-85b2-4d54-9467-09c0dcd00001'
        memory_id = 'a9caaf82-85b2-4d54-9467-09c0dcd00002'
        self.responses['galeria'] = [{'id': photo_id, 'imagem_url': '/assets/images/flowers.jpg', 'legenda': 'Foto protegida', 'data_foto': '2026-10-15'}]
        self.responses['memorias'] = [{'id': memory_id, 'titulo': 'Memória protegida', 'data_memoria': '2026-10-15', 'descricao': 'Uma lembrança.'}]
        self.open()
        expect(self.page.locator('.memory-card')).to_have_count(1)
        expect(self.page.locator('.content-delete-button')).to_have_count(0)
        self.page.set_viewport_size({'width': 390, 'height': 844})

        self.page.locator('#gallery-authorize-delete').click()
        expect(self.page.locator('#admin-capability-dialog')).to_be_visible()
        self.page.locator('#admin-capability-item').select_option(photo_id)
        expect(self.page.locator('#admin-capability-command')).to_have_value(re.compile(photo_id))
        self.page.locator('#admin-capability-token').fill('A' * 43)
        self.page.locator('#admin-capability-submit').click()
        photo_delete = self.page.locator('.photo-card-shell .content-delete-button')
        expect(photo_delete).to_have_accessible_name('Excluir fotografia')
        self.assertEqual(self.page.locator('.memory-card .content-delete-button').count(), 0)
        box = photo_delete.bounding_box()
        self.assertGreaterEqual(box['x'], 0)
        self.assertLessEqual(box['x'] + box['width'], 390)
        photo_delete.click()
        expect(self.page.locator('#content-delete-dialog')).to_be_visible()
        expect(self.page.locator('#content-delete-title')).to_contain_text('Tem certeza que deseja apagar essa lembrança?')
        self.page.locator('#content-delete-cancel').click()
        expect(self.page.locator('.photo-card')).to_have_count(1)
        self.assertFalse(any(name == 'galeria' and req.method == 'DELETE' for name, req in self.requests))
        photo_delete.click()
        self.page.locator('#content-delete-confirm').click()
        expect(self.page.locator('.photo-card')).to_have_count(0)
        expect(self.page.locator('#gallery-delete-feedback')).to_be_visible()
        photo_request = next(req for name, req in self.requests if name == 'galeria' and req.method == 'DELETE')
        self.assertEqual(photo_request.url.split('id=', 1)[1], photo_id)
        self.assertEqual(photo_request.headers.get('x-admin-capability'), 'A' * 43)

        self.page.locator('#memory-authorize-delete').click()
        self.page.locator('#admin-capability-item').select_option(memory_id)
        self.page.locator('#admin-capability-token').fill('B' * 43)
        self.page.locator('#admin-capability-submit').click()
        memory_delete = self.page.locator('.memory-card .content-delete-button')
        expect(memory_delete).to_have_accessible_name('Excluir memória')
        memory_delete.click()
        self.page.locator('#content-delete-confirm').click()
        expect(self.page.locator('.memory-card')).to_have_count(0)
        memory_request = next(req for name, req in self.requests if name == 'memorias' and req.method == 'DELETE')
        self.assertEqual(memory_request.post_data_json, {'id': memory_id})
        self.assertEqual(memory_request.headers.get('x-admin-capability'), 'B' * 43)

    def test_admin_delete_failure_keeps_card_and_consumes_temporary_capability(self):
        photo_id = 'a9caaf82-85b2-4d54-9467-09c0dcd00003'
        self.responses['galeria'] = [{'id': photo_id, 'imagem_url': '/assets/images/park.jpg', 'legenda': 'Foto permanece', 'data_foto': '2026-10-15'}]
        self.responses['galeria_delete'] = (503, {'error': 'temporariamente indisponível'})
        self.open()
        self.page.locator('#gallery-authorize-delete').click()
        self.page.locator('#admin-capability-item').select_option(photo_id)
        self.page.locator('#admin-capability-token').fill('C' * 43)
        self.page.locator('#admin-capability-submit').click()
        self.page.locator('.photo-card-shell .content-delete-button').click()
        self.page.locator('#content-delete-confirm').click()
        expect(self.page.locator('#content-delete-status')).to_contain_text('temporariamente indisponível')
        expect(self.page.locator('.photo-card')).to_have_count(1)
        expect(self.page.locator('.content-delete-button')).to_have_count(0)

    def test_calendar_multiple_events_navigation_and_focus(self):
        self.open()
        today = self.page.evaluate("async () => (await import('/js/utils/dates.js')).todayKey()")
        self.responses['encontros'] = [{'id': str(i), 'titulo': f'Encontro {i}', 'data_encontro': today, 'horario_inicio': '14:00'} for i in range(2)]
        self.page.reload()
        button = self.page.locator(f'[data-date="{today}"]')
        expect(button).to_have_class('today has-event')
        expect(button).to_have_attribute('aria-label', re.compile(r'2 encontro'))
        button.click()
        expect(self.page.locator('.event')).to_have_count(2)
        expect(self.page.locator('#event-details-dialog')).to_be_visible()
        expect(self.page.locator('.event-dialog-item')).to_have_count(2)
        expect(self.page.locator('#event-dialog-close')).to_be_focused()
        self.page.locator('#event-dialog-close').click()
        before = self.page.locator('#calendar-month').text_content()
        next_date = self.page.evaluate("""async () => {
          const [year, month] = (await import('/js/utils/dates.js')).todayKey().split('-').map(Number);
          return `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}-05`;
        }""")
        self.responses['encontros'] = [{'id': 'next', 'titulo': 'Próximo mês', 'data_encontro': next_date, 'horario_inicio': '18:30', 'local': 'Café'}]
        self.page.locator('#next-month').click()
        self.assertNotEqual(before, self.page.locator('#calendar-month').text_content())
        expect(self.page.locator(f'[data-date="{next_date}"]')).to_have_class('has-event')
        expect(self.page.locator('.event')).to_have_count(1)
        self.assertEqual(sum(1 for name, request in self.requests if name == 'encontros' and request.method == 'GET'), 3)
        self.page.locator(f'[data-date="{next_date}"]').click()
        expect(self.page.locator('.event-dialog-item')).to_contain_text('Próximo mês')
        self.page.locator('#event-dialog-close').click()
        self.page.locator('#prev-month').click()
        expect(self.page.locator('#calendar-month')).to_have_text(before)

    def test_calendar_timezone_and_leap_day(self):
        self.open()
        result = self.page.evaluate("""async () => {
          const {isDate} = await import('/js/utils/validators.js');
          const {formatDate} = await import('/js/utils/dates.js');
          return [isDate('2024-02-29'), isDate('2026-02-29'), formatDate('2024-02-29')];
        }""")
        self.assertEqual(result, [True, False, '29 de fevereiro de 2024'])

    def test_music_player_controls_autoplay_volume_progress_loop_and_mobile(self):
        self.page.add_init_script("""(() => {
          const proto = HTMLMediaElement.prototype;
          Object.defineProperty(proto, 'paused', {configurable: true, get() { return !this.__playing; }});
          Object.defineProperty(proto, 'duration', {configurable: true, get() { return this.__duration || 180; }});
          Object.defineProperty(proto, 'currentTime', {configurable: true, get() { return this.__time || 0; }, set(value) { this.__time = Number(value); }});
          proto.play = function() { this.__playing = true; this.dispatchEvent(new Event('play')); return Promise.resolve(); };
          proto.pause = function() { this.__playing = false; this.dispatchEvent(new Event('pause')); };
        })()""")
        self.open()
        audio = self.page.locator('#background-music')
        expect(audio).to_have_attribute('src', '/assets/audio/nossa-musica.mp3')
        self.page.set_viewport_size({'width': 320, 'height': 720})
        toggle = self.page.locator('#music-toggle')
        box = toggle.bounding_box()
        self.assertGreaterEqual(box['x'], 0)
        self.assertLessEqual(box['x'] + box['width'], 320)
        self.assertEqual(self.page.locator('audio').count(), 1)
        toggle.click()
        self.page.locator('#music-pause').click()
        expect(self.page.locator('#music-status')).to_have_text('Música pausada.')
        expect(self.page.locator('#music-play')).to_be_enabled()
        self.page.locator('#music-play').click()
        expect(self.page.locator('#music-pause')).to_be_enabled()
        self.page.locator('#music-volume').evaluate("el => { el.value = '0.2'; el.dispatchEvent(new Event('input', {bubbles: true})); }")
        self.assertEqual(self.page.evaluate("localStorage.getItem('mybae-music-volume')"), '0.2')
        self.page.locator('#music-mute').click()
        self.assertEqual(self.page.locator('#music-volume').input_value(), '0')
        self.page.locator('#music-loop').uncheck()
        expect(audio).not_to_have_attribute('loop', '')
        expect(self.page.locator('#music-panel')).to_be_visible()
        self.page.locator('#music-progress').evaluate("el => { el.value = '45'; el.dispatchEvent(new Event('input', {bubbles: true})); }")
        self.assertEqual(self.page.locator('#music-elapsed').text_content(), '0:45')
        self.page.locator('#music-close').click()
        expect(self.page.locator('#music-panel')).to_be_hidden()

    def test_music_player_autoplay_block_uses_manual_button_without_unhandled_rejection(self):
        self.page.add_init_script("""(() => {
          const proto = HTMLMediaElement.prototype;
          Object.defineProperty(proto, 'paused', {configurable: true, get() { return !this.__playing; }});
          proto.play = function() {
            this.__tries = (this.__tries || 0) + 1;
            if (this.__tries === 1) return Promise.reject(new DOMException('Blocked', 'NotAllowedError'));
            this.__playing = true; this.dispatchEvent(new Event('play')); return Promise.resolve();
          };
          proto.pause = function() { this.__playing = false; this.dispatchEvent(new Event('pause')); };
        })()""")
        self.open()
        expect(self.page.locator('#music-panel')).to_be_visible()
        expect(self.page.locator('#music-status')).to_contain_text('bloqueada pelo navegador')
        self.page.locator('#music-manual-play').click()
        expect(self.page.locator('#music-pause')).to_be_enabled()
        self.assertEqual(self.errors, [])

    def test_api_error_retry_and_invalid_data(self):
        self.responses['galeria'] = (503, {})
        self.responses['encontros'] = {'invalid': True}
        self.open()
        expect(self.page.locator('#gallery-grid .retry')).to_be_visible()
        expect(self.page.locator('#event-list')).to_contain_text('formato inesperado')
        self.responses['galeria'] = []
        self.page.locator('#gallery-grid .retry').click()
        expect(self.page.locator('#gallery-grid')).to_contain_text('As nossas melhores páginas')

    def test_gallery_accepts_url_sorts_newest_and_refreshes_expired_signed_url(self):
        self.responses['galeria'] = [
            {'id': 'old', 'url': '/assets/images/flowers.jpg', 'legenda': 'Mais antiga', 'data_foto': '2026-10-15', 'created_at': '2026-10-15T10:00:00Z'},
            {'id': 'new', 'url': '/assets/images/park.jpg', 'legenda': 'Mais recente', 'data_foto': '2026-10-15', 'created_at': '2026-10-15T12:00:00Z'},
        ]
        self.open()
        expect(self.page.locator('.photo-card')).to_have_count(2)
        expect(self.page.locator('.photo-card').first).to_contain_text('Mais recente')

        initial_url = 'https://project.supabase.co/storage/v1/object/sign/fotos/photo.jpg?token=short-lived'
        renewed_url = 'https://project.supabase.co/storage/v1/object/sign/fotos/photo.jpg?token=renewed'
        image_bytes = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')
        self.page.route('https://project.supabase.co/**', lambda route: route.fulfill(status=200, content_type='image/png', body=image_bytes))
        self.responses['galeria'] = [{'id': 'signed', 'storage_path': 'photo.jpg', 'url': initial_url, 'legenda': 'Assinada', 'data_foto': '2026-10-15'}]
        self.page.reload()
        expect(self.page.locator('.photo-card')).to_have_count(1)
        self.responses['galeria'] = [{'id': 'signed', 'storage_path': 'photo.jpg', 'url': renewed_url, 'legenda': 'Assinada', 'data_foto': '2026-10-15'}]
        self.page.locator('.photo-card img').evaluate("img => img.dispatchEvent(new Event('error'))")
        expect(self.page.locator('.photo-card img')).to_have_attribute('src', renewed_url)
        self.assertEqual(sum(1 for name, request in self.requests if name == 'galeria' and request.method == 'GET'), 3)

    def test_memory_cards_modal_post_201_refresh_and_text_safety(self):
        self.responses['memorias'] = []
        self.open()
        expect(self.page.locator('#memory-list')).to_contain_text('Toda história começa com um instante.')
        expect(self.page.locator('#memory-add')).to_be_visible()
        self.page.locator('#memory-add').click()
        expect(self.page.locator('#memory-dialog')).to_be_visible()
        self.page.keyboard.press('Escape')
        expect(self.page.locator('#memory-dialog')).not_to_be_visible()
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.locator('#memory-add').click()
        bounds = self.page.locator('#memory-dialog').bounding_box()
        self.assertGreaterEqual(bounds['x'], 0)
        self.assertLessEqual(bounds['x'] + bounds['width'], 390)
        self.page.locator('[name=titulo]').fill('<script>Dia especial</script>')
        self.page.locator('[name=data_memoria]').fill('2026-10-15')
        self.page.locator('#memory-form [name=descricao]').fill('<img src=x onerror=alert(1)> risadas e carinho')
        self.page.locator('#memory-submit').click()
        expect(self.page.locator('#memory-feedback')).to_contain_text('Memória guardada com carinho!')
        expect(self.page.locator('.memory-card')).to_have_count(1)
        expect(self.page.locator('.memory-card h3')).to_have_text('<script>Dia especial</script>')
        expect(self.page.locator('.memory-card p')).to_have_text('<img src=x onerror=alert(1)> risadas e carinho')
        self.assertEqual(self.page.locator('.memory-card script, .memory-card img').count(), 0)
        post = next(request for name, request in self.requests if name == 'memorias' and request.method == 'POST')
        self.assertEqual(post.post_data_json, {
            'titulo': '<script>Dia especial</script>',
            'data_memoria': '2026-10-15',
            'descricao': '<img src=x onerror=alert(1)> risadas e carinho',
        })
        self.assertEqual(sum(1 for name, request in self.requests if name == 'memorias' and request.method == 'GET'), 2)

    def test_memory_post_error_is_not_reported_as_saved(self):
        self.responses['memorias'] = []
        self.responses['memorias_create'] = (405, {'error': 'Método não permitido.'})
        self.open()
        self.page.locator('#memory-add').click()
        self.page.locator('[name=titulo]').fill('Um dia feliz')
        self.page.locator('[name=data_memoria]').fill('2026-10-15')
        self.page.locator('#memory-form [name=descricao]').fill('A gente sorriu muito.')
        self.page.locator('#memory-submit').click()
        expect(self.page.locator('#memory-form-status')).to_contain_text('backend ainda não habilita POST')
        expect(self.page.locator('#memory-dialog')).to_be_visible()
        expect(self.page.locator('#memory-feedback')).to_be_hidden()

    def test_planner_validation_success_and_poster(self):
        self.responses['ai'] = self.itinerary()
        self.open()
        self.page.locator('#planner-form button[type=submit]').click()
        self.assertFalse(any(name == 'ai' for name, _ in self.requests))
        self.fill_planner()
        self.page.locator('#planner-form button[type=submit]').click()
        expect(self.page.locator('.itinerary-title h3')).to_have_text('Passeio de teste')
        expect(self.page.locator('.itinerary-step')).to_have_count(1)
        expect(self.page.locator('#planner-form')).to_have_attribute('aria-busy', 'false')
        self.page.locator('#view-poster').click()
        expect(self.page.locator('#view-poster')).to_have_attribute('aria-pressed', 'true')
        expect(self.page.locator('.location-controls')).to_be_hidden()
        self.page.locator('#view-interactive').click()
        expect(self.page.locator('.location-controls')).to_be_visible()
        request = next(req for name, req in self.requests if name == 'ai')
        self.assertEqual(request.method, 'POST')
        self.assertEqual(request.post_data_json['cidade'], 'Belo Horizonte, MG')

    def manual_import_document(self, count=7, *, missing=None):
        fields = [
            {"name": "manual_titulo", "value": "Roteiro restaurado"},
            {"name": "manual_data", "value": "2027-01-15"},
            {"name": "manual_cidade", "value": "Belo Horizonte"},
            {"name": "manual_inicio", "value": "08:00"},
            {"name": "manual_fim", "value": "22:00"},
            {"name": "manual_transporte", "value": "A p\u00e9"},
            {"name": "manual_descricao", "value": "Um dia especial restaurado do arquivo."},
        ]
        for i in range(count):
            fields.extend([
                {"name": "manual_horario", "value": f"{8 + i:02d}:00"},
                {"name": "manual_nome", "value": f"Local {i + 1}"},
                {"name": "manual_etapa_descricao", "value": f"Descri\u00e7\u00e3o da etapa {i + 1}."},
                {"name": "manual_endereco", "value": f"Rua de teste {i + 1}, 100"},
                {"name": "manual_fotografia", "value": f"foto-antiga-{i + 1}.jpg"},
            ])
        if missing:
            fields = [field for field in fields if field['name'] != missing]
        fields.append({"name": "campo_desconhecido", "value": "ignorar com seguran\u00e7a"})
        return {"salvoEm": "2026-10-15T12:00:00.000Z", "campos": fields}

    def import_manual_file(self, document):
        content = json.dumps(document, ensure_ascii=False).encode('utf-8')
        self.page.locator('#manual-import-file').set_input_files({
            'name': 'meu-roteiro-mybae.json', 'mimeType': 'application/json', 'buffer': content,
        })

    def test_manual_import_restores_seven_steps_repeated_fields_and_preview(self):
        self.open()
        self.page.locator('#manual-itinerary-open').click()
        self.import_manual_file(self.manual_import_document())
        expect(self.page.locator('#manual-import-confirm')).to_be_visible()
        self.page.locator('#manual-import-apply').click()
        expect(self.page.locator('#manual-itinerary-status')).to_contain_text('Seu roteiro foi restaurado com sucesso')
        expect(self.page.locator('#manual-itinerary-status')).to_contain_text('fotografias precisam ser selecionadas novamente')
        self.assertEqual(self.page.locator('#manual-steps .manual-step').count(), 7)
        form = self.page.locator('#manual-itinerary-form')
        self.assertEqual(form.locator('[name=manual_titulo]').input_value(), 'Roteiro restaurado')
        self.assertEqual(form.locator('[name=manual_transporte]').input_value(), 'A p\u00e9')
        self.assertEqual(form.locator('.manual-step [name=manual_horario]').nth(6).input_value(), '14:00')
        self.assertEqual(form.locator('.manual-step [name=manual_etapa_descricao]').nth(3).input_value(), 'Descri\u00e7\u00e3o da etapa 4.')
        self.assertEqual(form.locator('.manual-step [name=manual_endereco]').nth(2).input_value(), 'Rua de teste 3, 100')
        self.assertTrue(self.page.locator('#manual-step-limit').inner_text().startswith('7 de 30'))
        self.page.locator('#manual-preview').click()
        expect(self.page.locator('.itinerary-steps .itinerary-step')).to_have_count(7)
        expect(self.page.locator('.itinerary-step').nth(3)).to_contain_text('Descri\u00e7\u00e3o da etapa 4.')
        self.assertEqual(self.page.locator('.itinerary-step time').nth(6).inner_text(), '14:00')

    def test_manual_import_invalid_json_missing_fields_and_more_than_30_steps(self):
        self.open()
        self.page.locator('#manual-itinerary-open').click()
        self.page.locator('#manual-import-file').set_input_files({
            'name': 'malformado.json', 'mimeType': 'application/json', 'buffer': b'{not json',
        })
        expect(self.page.locator('#manual-itinerary-status')).to_contain_text('JSON v')
        self.import_manual_file(self.manual_import_document(missing='manual_cidade'))
        expect(self.page.locator('#manual-itinerary-status')).to_contain_text('falta manual_cidade')
        self.import_manual_file(self.manual_import_document(31))
        expect(self.page.locator('#manual-itinerary-status')).to_contain_text('de 1 a 30 etapas')
        self.assertEqual(self.page.locator('#manual-steps .manual-step').count(), 1)

    def test_manual_import_cancel_keeps_existing_form_unchanged(self):
        self.open()
        self.page.locator('#manual-itinerary-open').click()
        form = self.page.locator('#manual-itinerary-form')
        form.locator('[name=manual_titulo]').fill('Conte\u00fado atual')
        form.locator('.manual-step [name=manual_nome]').fill('Etapa atual')
        self.import_manual_file(self.manual_import_document())
        self.page.locator('#manual-import-cancel').click()
        self.assertFalse(self.page.locator('#manual-import-confirm').is_visible())
        self.assertEqual(form.locator('[name=manual_titulo]').input_value(), 'Conte\u00fado atual')
        self.assertEqual(form.locator('.manual-step [name=manual_nome]').input_value(), 'Etapa atual')
        self.assertEqual(self.page.locator('#manual-steps .manual-step').count(), 1)

    def test_manual_itinerary_steps_reorder_remove_preview_and_save_to_backend(self):
        self.open()
        self.page.locator('#manual-itinerary-open').click()
        expect(self.page.locator('#manual-itinerary-dialog')).to_be_visible()
        today = self.page.evaluate("async () => (await import('/js/utils/dates.js')).todayKey()")
        form = self.page.locator('#manual-itinerary-form')
        form.locator('[name=manual_titulo]').fill('Nosso Rolê')
        form.locator('[name=manual_data]').fill(today)
        form.locator('[name=manual_cidade]').fill('Belo Horizonte')
        form.locator('[name=manual_inicio]').fill('09:00')
        form.locator('[name=manual_fim]').fill('12:00')
        form.locator('[name=manual_transporte]').fill('A pé')
        form.locator('[name=manual_descricao]').fill('Um encontro montado por nós.')
        first = self.page.locator('.manual-step').first
        first.locator('[name=manual_horario]').fill('09:00')
        first.locator('[name=manual_nome]').fill('Praça Sete')
        first.locator('[name=manual_etapa_descricao]').fill('Primeira parada informada.')
        first.locator('[name=manual_endereco]').fill('Praça Sete, Belo Horizonte')
        first.locator('[name=manual_fotografia]').set_input_files({
            'name': 'parada.png', 'mimeType': 'image/png',
            'buffer': base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')
        })
        self.page.locator('#manual-add-step').click()
        second = self.page.locator('.manual-step').nth(1)
        second.locator('[name=manual_horario]').fill('11:00')
        second.locator('[name=manual_nome]').fill('Despedida')
        second.locator('[name=manual_etapa_descricao]').fill('Última parada informada.')
        second.locator('[name=manual_endereco]').fill('Centro, Belo Horizonte')
        self.page.locator('#manual-add-step').click()
        expect(self.page.locator('.manual-step')).to_have_count(3)
        self.page.locator('.manual-step').nth(2).locator('[data-action=remove]').click()
        self.page.locator('.manual-step').nth(1).locator('[data-action=up]').click()
        expect(self.page.locator('.manual-step').first.locator('.manual-step-number')).to_have_text('Etapa 1')
        self.page.locator('.manual-step').first.locator('[name=manual_horario]').fill('09:00')
        self.page.locator('.manual-step').nth(1).locator('[name=manual_horario]').fill('11:00')
        self.page.locator('#manual-save').evaluate('(button) => { button.click(); button.click(); }')
        expect(self.page.locator('#manual-itinerary-status')).to_contain_text('Encontro salvo e publicado')
        request = next(request for name, request in self.requests if name == 'encontros' and request.method == 'POST')
        body = request.post_data_json
        self.assertEqual(body['titulo'], 'Nosso Rolê')
        self.assertEqual(body['horario_fim'], '12:00')
        self.assertEqual([stage['ordem'] for stage in body['etapas']], [1, 2])
        self.assertEqual(len([request for name, request in self.requests if name == 'encontros' and request.method == 'POST']), 1)
        self.assertTrue(all(not any(value.startswith('blob:') for value in stage.values() if isinstance(value, str)) for stage in body['etapas']))
        self.assertFalse(any(name == 'galeria' and request.method == 'POST' for name, request in self.requests))
        self.page.locator('#manual-itinerary-close').click()
        expect(self.page.locator(f'#calendar-days [data-date="{today}"]')).to_have_class(re.compile('has-event'))
        self.page.locator(f'#calendar-days [data-date="{today}"]').click()
        expect(self.page.locator('#event-details-dialog')).to_be_visible()
        expect(self.page.locator('#event-dialog-list')).to_contain_text('Nosso Rolê')
        self.page.locator('#event-dialog-list .event-dialog-route').click()
        expect(self.page.locator('.itinerary-title h3')).to_have_text('Nosso Rolê')
        expect(self.page.locator('.itinerary-title h3')).to_have_text('Nosso Rolê')
        expect(self.page.locator('.itinerary-title')).to_contain_text('Transporte: A pé')
        expect(self.page.locator('.itinerary-step')).to_have_count(2)
        expect(self.page.locator('.itinerary-step').first.locator('h4')).to_have_text('Despedida')
        expect(self.page.locator('.itinerary-step img')).to_have_count(0)

    def test_manual_itinerary_server_errors_keep_the_form_and_do_not_confirm_save(self):
        self.open()
        self.page.locator('#manual-itinerary-open').click()
        form = self.page.locator('#manual-itinerary-form')
        today = self.page.evaluate("async () => (await import('/js/utils/dates.js')).todayKey()")
        form.locator('[name=manual_titulo]').fill('Encontro para guardar')
        form.locator('[name=manual_data]').fill(today)
        form.locator('[name=manual_cidade]').fill('Belo Horizonte')
        form.locator('[name=manual_inicio]').fill('09:00')
        form.locator('[name=manual_fim]').fill('12:00')
        form.locator('[name=manual_transporte]').fill('Carro')
        form.locator('[name=manual_descricao]').fill('Descrição que deve ser preservada.')
        stage = self.page.locator('.manual-step').first
        stage.locator('[name=manual_horario]').fill('09:00')
        stage.locator('[name=manual_nome]').fill('Primeira parada')
        stage.locator('[name=manual_etapa_descricao]').fill('Descrição da primeira etapa.')
        stage.locator('[name=manual_endereco]').fill('Centro, Belo Horizonte')
        self.page.locator('#manual-add-step').click()
        stage = self.page.locator('.manual-step').nth(1)
        stage.locator('[name=manual_horario]').fill('11:00')
        stage.locator('[name=manual_nome]').fill('Segunda parada')
        stage.locator('[name=manual_etapa_descricao]').fill('Descrição da segunda etapa.')
        stage.locator('[name=manual_endereco]').fill('Savassi, Belo Horizonte')
        for status_code, expected in [
            (400, 'campos e horários'), (413, 'excede o limite'), (429, 'limite de cadastros'),
            (500, 'servidor não conseguiu salvar'), (503, 'temporariamente indisponível'),
            (200, 'HTTP 200'),
        ]:
            self.responses['encontros_create'] = (status_code, {'error': 'mock error'})
            self.page.locator('#manual-save').click()
            expect(self.page.locator('#manual-itinerary-status')).to_contain_text(expected)
            expect(self.page.locator('#manual-save')).to_be_enabled()
        expect(form.locator('[name=manual_titulo]')).to_have_value('Encontro para guardar')
        self.assertFalse(any(name == 'encontros' and request.method == 'GET' and '/api/encontros?' in request.url for name, request in self.requests))

    def test_planner_malformed_and_rate_limit(self):
        self.responses['ai'] = {'titulo': 'Inválido'}
        self.open()
        self.fill_planner()
        self.page.locator('#planner-form button[type=submit]').click()
        expect(self.page.locator('#planner-status')).to_contain_text('roteiro inválido')
        expect(self.page.locator('.itinerary-step')).to_have_count(6)
        self.responses['ai'] = (429, {})
        self.page.locator('#planner-form button[type=submit]').click()
        expect(self.page.locator('#planner-status')).to_contain_text('Muitas solicitações')
        expect(self.page.locator('#planner-form button[type=submit]')).to_be_enabled()

    def test_maps_confirmed_marker_and_navigation(self):
        self.responses['mapas'] = [{'nome': 'Local de teste', 'latitude': -19.92, 'longitude': -43.93}]
        self.open()
        control = self.page.locator('.location-controls').first
        control.locator('button').click()
        control.locator('select').select_option('0')
        expect(self.page.locator('.route-map')).to_be_visible()
        expect(self.page.locator('.map-pin')).to_have_count(1)
        expect(self.page.locator('.confirmed-address')).to_contain_text('Local de teste')
        self.assertIn('destination=-19.92,-43.93', self.page.locator('.confirmed-address a').get_attribute('href'))

    def test_api_deduplication_timeout_and_allowlist(self):
        self.open()
        result = self.page.evaluate("""async () => {
          const {api} = await import('/js/api.js');
          const {CONFIG} = await import('/js/config.js');
          const a = api('memorias'), b = api('memorias');
          const same = a === b; await a;
          let blocked = false;
          try { await api('admin/session'); } catch { blocked = true; }
          const original = window.fetch;
          CONFIG.REQUEST_TIMEOUT_MS = 10;
          window.fetch = (url, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
          let timeout;
          try { await api('galeria'); } catch (error) { timeout = error.message; }
          finally { window.fetch = original; }
          return {same, blocked, timeout};
        }""")
        self.assertTrue(result['same'])
        self.assertTrue(result['blocked'])
        self.assertIn('demorou', result['timeout'])

    def test_responsive_navigation_and_reduced_motion(self):
        self.open()
        for width in [320, 375, 768, 1024, 1440, 1920]:
            self.page.set_viewport_size({'width': width, 'height': 900})
            self.page.locator('#view-poster').click()
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), width, f'overflow at {width}')
            self.page.locator('#view-interactive').click()
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), width, f'overflow at {width}')
        self.page.set_viewport_size({'width': 375, 'height': 900})
        self.page.locator('.menu-toggle').click()
        expect(self.page.locator('#navigation')).to_be_visible()
        self.page.keyboard.press('Escape')
        expect(self.page.locator('.menu-toggle')).to_have_attribute('aria-expanded', 'false')
        self.page.locator('.menu-toggle').click()
        self.page.locator('#navigation a').first.click()
        expect(self.page.locator('.menu-toggle')).to_have_attribute('aria-expanded', 'false')
        self.assertEqual(self.page.evaluate("getComputedStyle(document.documentElement).scrollBehavior"), 'auto')
        output = ROOT/'test-results'
        output.mkdir(exist_ok=True)
        self.page.screenshot(path=str(output/'mobile.png'), full_page=True)
        self.page.set_viewport_size({'width': 1440, 'height': 1000})
        self.page.screenshot(path=str(output/'desktop.png'), full_page=True)
        self.page.locator('#inicio').screenshot(path=str(output/'hero.png'))
        self.page.locator('#planejador').screenshot(path=str(output/'planner.png'))

    def test_network_invalid_json_and_image_allowlist(self):
        self.open()
        result = self.page.evaluate("""async () => {
          const {api} = await import('/js/api.js');
          const {safeImage} = await import('/js/components/ui.js');
          const original = window.fetch;
          const messages = [];
          try {
            window.fetch = async () => new Response('not-json', {status: 200});
            try { await api('galeria'); } catch (e) { messages.push(e.message); }
            window.fetch = async () => { throw new TypeError('network'); };
            try { await api('galeria'); } catch (e) { messages.push(e.message); }
          } finally { window.fetch = original; }
          return { messages, images: [
            safeImage('javascript:alert(1)'),
            safeImage('https://x.supabase.co/storage/v1/object/authenticated/a.jpg'),
            safeImage('https://x.supabase.co/storage/v1/object/public/a.jpg?token=secret'),
            safeImage('https://x.supabase.co/storage/v1/object/public/a.jpg'),
            safeImage('https://x.supabase.co/storage/v1/object/sign/fotos/a.jpg?token=short-lived')
          ] };
        }""")
        self.assertIn('resposta inválida', result['messages'][0])
        self.assertIn('conectar', result['messages'][1])
        self.assertEqual(result['images'][:3], ['', '', ''])
        self.assertTrue(result['images'][3].startswith('https://x.supabase.co/'))
        self.assertIn('/storage/v1/object/sign/', result['images'][4])

    def test_published_itinerary_link_and_invalid_coordinates(self):
        self.open()
        today = self.page.evaluate("async () => (await import('/js/utils/dates.js')).todayKey()")
        self.responses['encontros'] = [{'id': 42, 'titulo': 'Encontro de teste', 'data_encontro': today, 'horario_inicio': '09:00'}]
        self.responses['roteiros'] = [{'titulo': 'Publicado', 'encontro_id': 42, 'dados_json': self.itinerary()}]
        self.responses['mapas'] = [{'nome': 'Inválido', 'latitude': 999, 'longitude': 0}]
        self.page.reload()
        self.page.locator('.event summary').click()
        self.page.locator('.event-route').click()
        expect(self.page.locator('.itinerary-title h3')).to_have_text('Passeio de teste')
        control = self.page.locator('.location-controls').first
        control.locator('button').click()
        expect(control.locator('.location-message')).to_contain_text('inválidos')
        self.assertEqual(self.page.locator('.map-pin').count(), 0)

    def test_real_png_pdf_exports(self):
        self.open()
        output = ROOT/'test-results'
        output.mkdir(exist_ok=True)
        for fmt, signature in [('png', b'\x89PNG'), ('pdf', b'%PDF')]:
            with self.page.expect_download(timeout=60000) as event:
                self.page.locator(f'#export-{fmt}').click()
            download = event.value
            target = output/download.suggested_filename
            download.save_as(target)
            self.assertTrue(target.read_bytes().startswith(signature))
            expect(self.page.locator('#export-status')).to_have_text('Pôster exportado com carinho.')
            self.assertGreater(target.stat().st_size, 1000)

if __name__ == '__main__':
    unittest.main(verbosity=2)
