# My Bae

O pequeno universo de Jorge e Antonia: história, fotografias, encontros e planejamento de passeios. Frontend estático, sem login, reaproveitado do projeto original. A administração acontece fora deste site.

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

Edite `js/config.js` e preencha `CONFIG.API_BASE_URL` com a URL pública real, sem `/api` no final. Ela começa vazia de propósito: nenhuma URL foi presumida e nenhuma chamada é enviada até haver configuração. Os estados vazios e mensagens de indisponibilidade continuam utilizáveis.

As rotas preservadas do frontend são `GET /api/memorias`, `/api/galeria`, `/api/encontros`, `/api/configuracoes`, `/api/roteiros` e `POST /api/ai`, `/api/mapas`. O backend privado não foi acessado: esses contratos refletem os consumidores originais, não uma integração confirmada. Confira os [contratos e pendências](docs/API.md) antes de conectar.

O backend separado precisa permitir a origem do frontend via CORS, incluindo `OPTIONS`, `GET`, `POST`, `Accept` e `Content-Type`. O cliente omite cookies e não envia credenciais. As requisições possuem timeout de 55 segundos; chamadas simultâneas idênticas compartilham a mesma promessa. Não há cache persistente dos dados nem envio privilegiado de conteúdo.

## Fotografias e Supabase

O navegador lê o conteúdo aprovado através da API. Cabe ao backend filtrar publicações e acessar o Supabase com as permissões adequadas. Não existe SDK Supabase nem segredo no cliente. Administração, uploads e alterações de conteúdo pertencem ao backend protegido ou ao painel Supabase.

Imagens aceitas: arquivos em `/assets/images/` da mesma origem e URLs HTTPS `https://<projeto>.supabase.co/storage/v1/object/public/...`, sem credenciais, parâmetros ou fragmentos. URLs privadas/assinadas e outros hosts são rejeitados. Para outro domínio autorizado, ajuste conscientemente `safeImage` em `js/components/ui.js`. O bucket deve conter somente imagens autorizadas para publicação. Uma URL pública não equivale a autorização de conteúdo.

As imagens locais são inspirações já presentes no projeto, identificadas na interface e em [CREDITS.md](assets/images/CREDITS.md). Elas não representam fotos do casal nem locais confirmados. Nenhuma foto ou conversa privada foi adicionada, e não há armazenamento de fotografias no localStorage.

## Planejamento com IA e mapas

Preencha cidade, data, horário, duração, orçamento, tipo de passeio e transporte; preferências e restrições são opcionais. O formulário valida os dados, impede envios concorrentes e envia os mesmos nomes de campos do frontend original. Somente o backend chama a IA; nenhuma chave Gemini ou Groq deve ser inserida aqui.

O roteiro recebido precisa passar pela validação antes de substituir a visualização atual. Os modos interativo e pôster preservam a apresentação do diário. Um roteiro ilustrativo original permanece explicitamente identificado como exemplo, sem encontro ou data cadastrados.

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
