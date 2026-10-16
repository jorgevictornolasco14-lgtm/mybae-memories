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
        name = route.request.url.rsplit('/', 1)[-1]
        self.requests.append((name, route.request))
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
            self.assertTrue((ROOT/url.lstrip('/')).is_file(), url)
        for file in (ROOT/'js').rglob('*.js'):
            for target in re.findall(r'from\s+"(\.[^"]+)"', file.read_text(encoding='utf-8')):
                self.assertTrue((file.parent/target).is_file(), f'{file}: {target}')
        self.assertFalse((ROOT/'admin.html').exists())
        self.assertNotIn('/admin', html)
        self.open()
        self.assertEqual(self.page.locator('input[type=password]').count(), 0)
        self.assertTrue(all('admin' not in name for name, _ in self.requests))

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
        expect(self.page).to_have_title('My Bae — Jorge & Antonia')
        self.responses['configuracoes'] = [{'nome_site': 123}]
        self.page.locator('#config-status .retry').click()
        expect(self.page.locator('#config-status')).to_contain_text('incompletos ou inválidos')
        self.responses['configuracoes'] = [{'nome_site': 'Conectado', 'nome_pessoa_1': None}]
        self.page.locator('#config-status .retry').click()
        expect(self.page).to_have_title('Conectado — Jorge & Antonia')
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
        expect(self.page).to_have_title('My Bae — Jorge & Antonia')

    def test_disconnected_backend(self):
        self.page.unroute('**/js/config.js')
        self.page.route('**/js/config.js', lambda route: route.fulfill(content_type='application/javascript', body=re.sub(r'API_BASE_URL: "[^"\n]*"', 'API_BASE_URL: ""', (ROOT/'js/config.js').read_text(encoding='utf-8'))))
        self.open()
        expect(self.page.locator('#gallery-grid')).to_contain_text('Quando o álbum estiver conectado')
        self.assertEqual(self.requests, [])
        expect(self.page.locator('#together')).to_be_hidden()

    def test_gallery_memories_lightbox_and_safe_images(self):
        self.responses['galeria'] = [
            {'imagem_url': '/assets/images/flowers.jpg', 'legenda': '<script>teste</script>', 'data_foto': '2026-10-01'},
            {'imagem_url': '/assets/images/park.jpg'},
            {'imagem_url': 'https://project.supabase.co/storage/v1/object/sign/private/photo.jpg?token=private'},
        ]
        self.responses['memorias'] = [{'titulo': '<b>Memória</b>', 'data_memoria': '2026-10-01'}]
        self.open()
        expect(self.page.locator('.photo-card')).to_have_count(2)
        expect(self.page.locator('.memory')).to_contain_text('<b>Memória</b>')
        self.assertEqual(self.page.locator('.memory b').count(), 0)
        self.page.locator('#gallery-sort').select_option('caption')
        self.page.locator('.photo-card').first.click()
        expect(self.page.locator('#lightbox')).to_be_visible()
        self.page.keyboard.press('ArrowRight')
        expect(self.page.locator('#lightbox-caption')).to_contain_text('<script>teste</script>')
        self.page.keyboard.press('Escape')
        expect(self.page.locator('#lightbox')).not_to_be_visible()
        expect(self.page.locator('.photo-card').first).to_be_focused()

    def test_calendar_multiple_events_navigation_and_focus(self):
        self.open()
        today = self.page.evaluate("async () => (await import('/js/utils/dates.js')).todayKey()")
        self.responses['encontros'] = [{'id': str(i), 'titulo': f'Encontro {i}', 'data_encontro': today, 'horario_inicio': '14:00'} for i in range(2)]
        self.page.reload()
        button = self.page.locator(f'[data-date="{today}"]')
        expect(button).to_have_class('today has-event')
        button.click()
        expect(self.page.locator('.event')).to_have_count(2)
        expect(self.page.locator(f'[data-date="{today}"]')).to_be_focused()
        before = self.page.locator('#calendar-month').text_content()
        self.page.locator('#next-month').click()
        self.assertNotEqual(before, self.page.locator('#calendar-month').text_content())
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

    def test_api_error_retry_and_invalid_data(self):
        self.responses['galeria'] = (503, {})
        self.responses['encontros'] = {'invalid': True}
        self.open()
        expect(self.page.locator('#gallery-grid .retry')).to_be_visible()
        expect(self.page.locator('#event-list')).to_contain_text('formato inesperado')
        self.responses['galeria'] = []
        self.page.locator('#gallery-grid .retry').click()
        expect(self.page.locator('#gallery-grid')).to_contain_text('As nossas melhores páginas')

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
            safeImage('https://x.supabase.co/storage/v1/object/public/a.jpg')
          ] };
        }""")
        self.assertIn('resposta inválida', result['messages'][0])
        self.assertIn('conectar', result['messages'][1])
        self.assertEqual(result['images'][:3], ['', '', ''])
        self.assertTrue(result['images'][3].startswith('https://x.supabase.co/'))

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
