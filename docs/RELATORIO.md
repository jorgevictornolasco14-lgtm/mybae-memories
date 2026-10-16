# Relatório da refatoração do My Bae

## Análise inicial

O checkout tinha dois HTMLs (`index.html` e `admin.html`), nove módulos JS na raiz de `js/`, seis CSS, fontes e imagens locais. Não havia backend, dependências instaladas no projeto, testes, README, `.gitignore` ou configuração da Vercel. O Git estava limpo antes das alterações.

A landing page já possuía a identidade preto/lilás/nude/rosa, seções semânticas, módulos ES, galeria com dialog, calendário e roteiro de exemplo. Esses componentes foram reaproveitados. O planejador e a exportação estavam acoplados ao módulo de roteiros, e memórias e navegação estavam em `main.js`. Não havia duplicação funcional significativa a remover; os problemas eram acoplamento e responsabilidades misturadas. O toast não tinha consumidor, e o sessionStorage de roteiros só alimentava a antiga administração.

Problemas encontrados: tela e endpoints administrativos; chamadas fixas à mesma origem; três bibliotecas referenciadas em `/vendor/` inexistente; falta de validação dos contratos e deduplicação; ausência de retry na agenda; URLs Supabase privadas/assinadas aceitas pela regra antiga; risco de dados inválidos quebrando renderizações; perda de foco ao reconstruir dias do calendário; cores repetidas; transbordamento de título em 320 px e da faixa decorativa em 768 px. A inspeção e os testes guiaram as correções.

## Melhorias implementadas

- Remoção do login, administração, chamadas administrativas e armazenamento da sessão que só alimentava o editor antigo.
- Separação de componentes, funcionalidades e utilitários, com imports verificados. O site continua HTML/CSS/JS sem framework e sem build.
- API configurável, com allowlist de rotas/métodos, omissão de credenciais, AbortController, timeout, deduplicação simultânea, mensagens locais e validação dos dados.
- Estados de carregamento com aria-busy, vazios e erros; retry em galeria, memórias e agenda. Falhas de roteiros publicados deixam mensagem visível.
- Datas civis preservadas em America/Sao_Paulo e cálculo de meses por UTC, independente do fuso do dispositivo; calendário com múltiplos eventos, hoje, seleção e foco preservado.
- Galeria com legenda opcional, ordenação robusta, lazy loading, datas, ampliação e teclado. Bloqueio de URLs privadas, assinadas e hosts não autorizados.
- Formulário de IA validado e protegido contra envios concorrentes; resposta inválida não substitui o roteiro atual. IA somente por backend.
- Roteiros interativos e pôster vertical, fotos públicas opcionais, associação de encontros com IDs numéricos/textuais, PNG/PDF reais.
- Leaflet/OpenStreetMap com marcadores numerados apenas depois da confirmação do resultado da geocodificação, endereço e link de navegação. Sem trajetos ou coordenadas inventados.
- Bibliotecas locais versionadas com licenças e hashes. A exportação não inclui controles nem mapa interativo.
- Cores CSS centralizadas; animações extraídas; tratamento de texto longo, formulário em coluna no celular, campos de 16 px e preferência de movimento reduzido.
- Metadados Open Graph, dialog com nome acessível, menu mobile com Escape e foco, configuração estática da raiz na Vercel e `.gitignore`.

## Testes executados e evidências

Executado com Python 3.13.14, Playwright 1.63.0 e Microsoft Edge headless instalado:

```powershell
$env:BROWSER_CHANNEL = 'msedge'
python -m unittest discover -s tests -v
```

Resultado: **14 testes aprovados**, sem erros JavaScript não tratados nos cenários. Após o ajuste final de tipografia mobile, o teste de responsividade foi repetido isoladamente e passou.

Cobertura: assets/imports, navegação e ausência de login, backend não configurado, galeria/modal/teclado, textos escapados, fotos privadas bloqueadas, memórias, calendário com múltiplos encontros e foco, troca de mês, data bissexta e fuso diferente, validação/sucesso/erros/429 do planejador, associação de roteiro publicado, modo pôster, marcador confirmado, coordenadas inválidas, JSON inválido, falha de rede, timeout, bloqueio de operação administrativa e deduplicação.

Responsividade verificada em **320, 375, 768, 1024, 1440 e 1920 px**, nos modos interativo e pôster, sem rolagem horizontal. Capturas desktop/mobile e das seções foram geradas em `test-results/` (ignorado no Git). As capturas foram inspecionadas para preservar a identidade existente. Os testes de exportação produziram arquivos PNG e PDF com assinaturas e tamanhos válidos usando as bibliotecas reais.

Os dados da API e os tiles dos mapas são mocks sintéticos. **Não foi verificada integração real com backend, Supabase, provedor de IA ou geocodificação.** O download do Chromium esperado pelo Playwright falhou por timeout de rede; os testes foram concluídos usando o Edge instalado, sem depender desse download. Safari, Firefox e aparelhos físicos não foram testados.

Verificações adicionais: `git diff --check` sem erros; `vercel.json` parseado como JSON válido; referências locais e imports existentes; busca no código de execução sem referências aos antigos endpoints administrativos, armazenamento local/sessão ou nomes de chaves secretas. Essa busca estática não constitui auditoria de histórico Git.

## Pendências da integração

Preencher a URL pública real em `js/config.js`. Confirmar com o backend privado as sete rotas, payloads, arrays diretos, formatos de datas/horários, permissões de leitura de conteúdo publicado, CORS, proteção contra abuso e serviço de geocodificação autorizado. Confirmar CORS e autorização das fotografias públicas. Detalhes em [API.md](API.md).

A data do relacionamento continua ausente até vir da configuração real. As fotografias de inspiração e o roteiro de exemplo foram preservados e permanecem identificados; nenhum encontro ou memória foi inventado. O mapa só recebe coordenadas do retorno validado da busca, depois de uma seleção humana; a confiabilidade da fonte é responsabilidade do backend. Exportações remotas dependem de CORS das imagens, e roteiros muito extensos dependem dos limites de memória/canvas do dispositivo.

## Arquivos criados

- `.gitignore`
- `README.md`
- `assets/vendor/README.md`
- `assets/vendor/html-to-image.LICENSE`
- `assets/vendor/html-to-image.js`
- `assets/vendor/jspdf.LICENSE`
- `assets/vendor/jspdf.js`
- `assets/vendor/leaflet/LICENSE`
- `assets/vendor/leaflet/images/layers-2x.png`
- `assets/vendor/leaflet/images/layers.png`
- `assets/vendor/leaflet/images/marker-icon-2x.png`
- `assets/vendor/leaflet/images/marker-icon.png`
- `assets/vendor/leaflet/images/marker-shadow.png`
- `assets/vendor/leaflet/leaflet.css`
- `assets/vendor/leaflet/leaflet.js`
- `css/animations.css`
- `docs/API.md`
- `docs/RELATORIO.md`
- `js/components/animations.js`
- `js/components/navbar.js`
- `js/components/ui.js`
- `js/config.js`
- `js/features/ai-planner.js`
- `js/features/calendar.js`
- `js/features/gallery.js`
- `js/features/itinerary-export.js`
- `js/features/itinerary.js`
- `js/features/maps.js`
- `js/features/memories.js`
- `js/utils/dates.js`
- `js/utils/validators.js`
- `tests/requirements.txt`
- `tests/test_frontend.py`
- `vercel.json`

## Arquivos modificados

- `css/components.css`
- `css/global.css`
- `css/responsive.css`
- `css/variables.css`
- `index.html`
- `js/api.js`
- `js/main.js`

## Arquivos removidos dos caminhos anteriores

- `admin.html`
- `css/admin.css`
- `js/admin.js`
- `js/animations.js`
- `js/calendar.js`
- `js/gallery.js`
- `js/itinerary.js`
- `js/maps.js`
- `js/ui.js`

`admin.html`, `css/admin.css` e `js/admin.js` foram excluídos. Os demais módulos removidos da raiz de `js/` foram reaproveitados em `js/components/` ou `js/features/`; não foram descartados. `main.js` foi reduzido e funções existentes foram extraídas para os novos módulos.

Nenhum commit, push ou deploy foi realizado.
