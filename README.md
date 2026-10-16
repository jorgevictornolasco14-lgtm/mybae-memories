# My Bae

O pequeno universo de Jorge e Maria: história, fotografias, encontros e planejamento de passeios. Frontend estático, sem login, reaproveitado do projeto original. A administração acontece fora deste site.

## Tecnologias e organização

HTML5, CSS3, JavaScript ES6+ com ES Modules e Fetch API. Fontes locais, Leaflet + OpenStreetMap, html-to-image e jsPDF. Sem framework, gerenciador de pacotes ou etapa de build. Bibliotecas distribuídas em `assets/vendor/`, com versões e licenças documentadas no [inventário](assets/vendor/README.md).

```text
index.html
css/                 # variáveis de cor, fontes, estilos globais, componentes,
                     # animações e responsividade
js/
  main.js            # inicialização e configuração pública da capa
  config.js          # URL pública e rotas do backend
  api.js             # HTTP, timeout, deduplicação e validação
  components/        # navegação, animações e utilitários de interface
  features/          # memórias, galeria, calendário, planejador, roteiros,
                     # exportação e mapas
  utils/             # datas e validadores
assets/              # imagens de inspiração, fontes, ícone e bibliotecas locais
tests/              # testes automatizados no navegador, com API simulada
docs/               # contratos observados e relatório da refatoração
vercel.json          # publicação estática da raiz
```

## Executar localmente

Com Python 3 instalado, na raiz:

```sh
python -m http.server 8080 --bind 127.0.0.1
```

Abra http://127.0.0.1:8080. Use HTTP local; abrir o HTML por `file://` impede o funcionamento normal dos módulos. O servidor é apenas uma ferramenta de desenvolvimento, não faz parte do backend da aplicação.

## Conectar o backend

`js/config.js` centraliza `CONFIG.API_BASE_URL`, já configurada como `https://mybae-backend-seven.vercel.app`, sem `/api` no final. `js/api.js` usa Fetch com CORS, sem cookies ou tokens. Ao abrir a página, `GET /api/configuracoes` é validado como array JSON; seu primeiro registro atualiza nome do site, nomes do casal e mensagem principal, preservando o conteúdo padrão para campos vazios. A interface informa carregamento, ausência de registros e falhas, com botão para tentar novamente. As animações e demais funcionalidades inicializam independentemente dessa leitura.

Em 15/10/2026, a consulta real de configurações sem `Origin` retornou 200 com os campos esperados. Galeria, memórias, encontros e roteiros retornaram arrays vazios; suas chamadas existentes foram preservadas, pois ainda não foi possível confirmar os campos dos registros. Os POSTs de IA/mapas permanecem sem nova validação em produção. Confira os [contratos e evidências](docs/API.md).

**Pendência no backend:** GET e OPTIONS rejeitam a origem publicada `https://mybae-memories.vercel.app` com HTTP 403 (`Origem não autorizada.`). As origens locais na porta 8080 também são rejeitadas. O teste real no navegador confirmou o bloqueio. A lista CORS do backend precisa autorizar essas origens antes de concluir a integração ponta a ponta. Alterações neste frontend não removem essa restrição do servidor.

O backend separado precisa permitir a origem do frontend via CORS, incluindo `OPTIONS`, `GET`, `POST`, `Accept` e `Content-Type`. O cliente omite cookies e não envia credenciais. As requisições possuem timeout de 55 segundos; chamadas simultâneas idênticas compartilham a mesma promessa. Não há cache persistente dos dados nem envio privilegiado de conteúdo.

## Fotografias e Supabase

O navegador lê o conteúdo aprovado através da API. Cabe ao backend filtrar publicações e acessar o Supabase com as permissões adequadas. Não existe SDK Supabase nem segredo no cliente. Administração, uploads e alterações de conteúdo pertencem ao backend protegido ou ao painel Supabase.

Imagens aceitas: arquivos em `/assets/images/` da mesma origem e URLs HTTPS `https://<projeto>.supabase.co/storage/v1/object/public/...`, sem credenciais, parâmetros ou fragmentos. URLs privadas/assinadas e outros hosts são rejeitados. Para outro domínio autorizado, ajuste conscientemente `safeImage` em `js/components/ui.js`. O bucket deve conter somente imagens autorizadas para publicação. Uma URL pública não equivale a autorização de conteúdo.

As imagens locais são inspirações já presentes no projeto, identificadas na interface e em [CREDITS.md](assets/images/CREDITS.md). Elas não representam fotos do casal nem locais confirmados. Nenhuma foto ou conversa privada foi adicionada, e não há armazenamento de fotografias no localStorage.

## Planejamento com IA e mapas

Preencha cidade, data, horário, duração e tipo de passeio; preferências e restrições são opcionais. Orçamento e transporte foram removidos deste formulário e não são enviados, nem como campos ocultos ou valores padrão. O formulário valida os dados e impede envios concorrentes. Somente o backend chama a IA; nenhuma chave Gemini ou Groq deve ser inserida aqui. O backend precisa aceitar os dois campos como opcionais; veja a [alteração de contrato e sua verificação](docs/planner-simplification.md).

Ao abrir o site, a seção de roteiros consulta `GET /api/roteiros` sem cache e mostra o primeiro registro publicado na ordem retornada pelo backend (`created_at` decrescente). A data do encontro e `updated_at` não definem o roteiro principal. Sem registros, há um convite para criar o primeiro roteiro; em falha, aparece uma mensagem com nova tentativa. O exemplo demonstrativo foi removido.

Depois de um cadastro manual confirmado com HTTP 201, o roteiro retornado pelo servidor torna-se o principal e a lista é consultada novamente. Ao atualizar ou reabrir a página, os dados são recuperados da API. Prévias manuais e sugestões da IA continuam disponíveis, identificadas como prévia; não são tratadas como persistência. Os modos interativo e pôster mantêm os componentes existentes. Consulte o [comportamento e a verificação do último roteiro](docs/latest-itinerary.md).

Para cada parada, pesquise o endereço pela API de mapas, confira os resultados e selecione uma correspondência. Só então aparece um marcador numerado no Leaflet; o endereço confirmado oferece um link de navegação. Não há coordenadas estimadas ou traçados de percurso. Os tiles são carregados diretamente do OpenStreetMap, com atribuição.

Exporte pelo botão PNG ou PDF. A exportação cria um pôster vertical, inclui as fotografias disponíveis e omite controles e mapa interativo. O PDF usa uma página de altura variável, adequada ao diário. Fontes e imagens precisam terminar de carregar; imagens remotas devem permitir CORS para exportação. Caso uma imagem falhe, a interface apresenta erro. Roteiros muito extensos podem atingir limites de canvas/memória em celulares.

## Vercel

Importe o repositório como projeto **Other**, com Root Directory na raiz do repositório. O `vercel.json` define `framework: null`, build vazio e `outputDirectory: "."`, conforme a [configuração oficial](https://vercel.com/docs/project-configuration/vercel-json). Não selecione `dist/` ou `public/`, não configure Functions ou pasta `api/`. O projeto serve `index.html`, `css/`, `js/` e `assets/` diretamente. Não há rewrite global que transforme erros de arquivos ou API em HTML.

Conecte a URL real do backend antes de publicar. O usuário controla a publicação; nenhum deploy é executado por estes arquivos. Como a saída é a raiz, todos os arquivos versionados devem ser apropriados para acesso público, inclusive documentação e fixtures de testes. Os mocks contêm somente dados sintéticos. Nunca coloque segredos ou conteúdo pessoal no repositório; o `.gitignore` exclui `.env*`, `.vercel/`, `node_modules/` e resultados temporários.

## Testes

Python 3.10+ e Playwright são dependências apenas de desenvolvimento:

```sh
python -m pip install -r tests/requirements.txt
python -m playwright install chromium
python -m unittest discover -s tests -v
```

Também é possível usar o Edge instalado no Windows:

```powershell
$env:BROWSER_CHANNEL = 'msedge'
python -m unittest discover -s tests -v
```

A suíte inicia um servidor estático local e usa mocks para os dados da API e tiles. Verifica navegação, ausência de login, assets/imports, galeria/modal, proteção de URLs de imagens, memórias, calendário/múltiplos eventos, datas em outro fuso, validação e falhas do planejador, modo pôster, marcadores, deduplicação, timeout e larguras de 320 a 1920 pixels. Os arquivos PNG/PDF são realmente gerados com as bibliotecas locais. Capturas e downloads ficam em `test-results/`, ignorado pelo Git.

Esses testes não comprovam conectividade com Supabase, IA, geocodificação ou backend de produção. Para publicar, faça uma verificação adicional com a API real e dispositivos/navegadores de destino.

## Contribuir

Preserve o estilo existente, os módulos ES e a ausência de login. Centralize cores em `css/variables.css` e chamadas HTTP em `js/api.js`. Confirme contratos antes de alterar rotas. Use somente recursos autorizados para publicação. Execute os testes, revise o diff e descreva alterações e limitações em seu pull request. Não inclua backend nem segredos neste repositório.
