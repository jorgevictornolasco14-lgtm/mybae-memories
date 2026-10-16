# Contratos e integração do backend

Backend público: `https://mybae-backend-seven.vercel.app`, centralizado em `js/config.js`. Verificação real em 15/10/2026 (America/Sao_Paulo): `GET /api/configuracoes` sem `Origin` retornou HTTP 200 com um array de um registro. Campos observados: `id`, `nome_site`, `nome_pessoa_1`, `nome_pessoa_2`, `data_inicio_relacionamento` (null), `mensagem_principal`, `imagem_capa` (string vazia), `created_at` e `updated_at`. O cliente usa `rows[0]`, valida os tipos públicos e mantém os textos padrão para campos ausentes ou vazios. Não existe envelope `{data: ...}`.

As outras quatro coleções abaixo foram consultadas via GET e retornaram HTTP 200 com `[]`. Isso confirma rota, método e array vazio, mas **não confirma os campos de registros, paginação ou vínculos**. As chamadas e validadores existentes foram preservados até haver registros públicos representativos ou documentação do backend. Os POSTs de IA e mapas não foram acionados nesta verificação; seus contratos abaixo continuam sendo expectativas do frontend original.

| Método | Rota | Resposta esperada |
| --- | --- | --- |
| GET | /api/memorias | Array: titulo, data_memoria (`YYYY-MM-DD`); descricao, categoria, destaque e imagem_url opcionais |
| GET | /api/galeria | Array: imagem_url; legenda, descricao, data_foto (`YYYY-MM-DD`) e created_at opcionais |
| GET | /api/encontros | Array: id, titulo, data_encontro (`YYYY-MM-DD`), horario_inicio (`HH:mm` ou `HH:mm:ss`); horario_fim, cidade, local, endereco, descricao, preferencias, orcamento e status opcionais |
| GET | /api/configuracoes | Confirmado: array; primeiro registro com nome_site, nome_pessoa_1, nome_pessoa_2, mensagem_principal, imagem_capa e data_inicio_relacionamento opcionais |
| GET | /api/roteiros | Array: titulo, dados_json (objeto de roteiro); encontro_id opcional |
| POST | /api/ai | Objeto de roteiro |
| POST | /api/mapas | Array: nome (endereço exibido), latitude e longitude numéricas e válidas |

## CORS: bloqueio confirmado

A origem de produção informada é `https://mybae-memories.vercel.app` (sem barra final). O backend respondeu **403** com `{"error":"Origem não autorizada."}` tanto em GET quanto em OPTIONS para essa origem, sem `Access-Control-Allow-Origin`. O mesmo ocorreu para `http://localhost:8080` e `http://127.0.0.1:8080`.

Teste real no Edge: abrir a página publicada e executar Fetch para configurações resulta em `Failed to fetch`. O frontend modificado, servido em `http://127.0.0.1:8080`, também tem suas cinco leituras bloqueadas por CORS; apresenta o erro de conexão e nova tentativa, sem erro JavaScript não capturado. Captura local: `test-results/live-cors-error.png` (ignorada pelo Git). Não foi simulado sucesso de integração real.

Correção necessária no backend: adicionar a origem exata de produção à lista permitida e, se desejado, as duas origens locais acima. Para uma origem autorizada, GET deve incluir `Access-Control-Allow-Origin` com essa origem e `Vary: Origin`, inclusive em respostas de erro. OPTIONS deve responder ao preflight com sucesso e permitir os métodos/headers efetivamente usados (`GET`, `POST`, `Accept`, `Content-Type`). O frontend usa `mode: "cors"`, `credentials: "omit"` e não envia tokens. Não usar `no-cors`: isso impediria a leitura do JSON. A configuração CORS e o deploy do backend não foram alterados neste repositório.

Reproduzir a verificação HTTP:

```powershell
curl.exe -i -H "Origin: https://mybae-memories.vercel.app" https://mybae-backend-seven.vercel.app/api/configuracoes
curl.exe -i -X OPTIONS -H "Origin: https://mybae-memories.vercel.app" -H "Access-Control-Request-Method: GET" https://mybae-backend-seven.vercel.app/api/configuracoes
```

Após a correção, servir o frontend localmente, verificar em Network que `/api/configuracoes` retorna 200 legível pelo navegador e conferir título, marcas, nomes e mensagem contra o primeiro registro. Repetir da origem publicada após um deploy autorizado. Para galeria, memórias, encontros e roteiros, confirmar os campos com registros reais antes de alterar mapeamentos; não inserir dados de teste no banco de produção para inferir contratos.

Validação local: os 18 testes de `tests/test_frontend.py` passaram no Edge (`BROWSER_CHANNEL=msedge`), incluindo configurações em array, primeiro registro, campos inválidos/nulos, carregamento, array vazio, erro HTTP e nova tentativa, atualização das marcas após renderizar outro roteiro e as funcionalidades existentes (galeria, calendário, planejador, mapas, exportações PNG/PDF e responsividade). Esses testes usam respostas simuladas; a verificação real acima permanece bloqueada pelo CORS. Nenhum login, chave Supabase, commit, push ou deploy foi adicionado/executado nesta integração.

## Formulário de IA

JSON preserva os valores textuais do FormData original:

```json
{
  "cidade": "Cidade de teste",
  "data": "2026-12-01",
  "inicio": "09:00",
  "duracao": "4",
  "orcamento": "150",
  "tipo": "Romântico",
  "transporte": "Aplicativo",
  "preferencias": "",
  "restricoes": ""
}
```

O backend precisa validar limites, datas, transporte e tipos aceitos; aplicar proteção contra abuso e limitar o custo de IA. A chamada é pública e não permite escrita administrativa.

## Roteiro

Campos necessários: titulo, cidade, inicio, fim, etapas (1–30). Cada etapa exige nome, horario, descricao e busca. data pode ser nula ou `YYYY-MM-DD`. descricao, chuva, alimentacao, custos e recomendacoes (array de strings) são opcionais e recebem valores vazios. Cada etapa pode conter imagem_url pública autorizada. Coordenadas vindas da IA não são usadas.

```json
{
  "titulo": "Roteiro de teste",
  "cidade": "Cidade de teste",
  "data": null,
  "inicio": "09:00",
  "fim": "11:00",
  "etapas": [{
    "nome": "Local de teste",
    "horario": "09:00",
    "descricao": "Atividade de teste",
    "busca": "Endereço de teste"
  }],
  "recomendacoes": []
}
```

## Geocodificação

`POST /api/mapas` envia `{ "query": "nome ou endereço a pesquisar" }`. A API precisa consultar um serviço autorizado e retornar correspondências verificáveis. O usuário seleciona uma delas. Latitude deve estar entre -90 e 90; longitude entre -180 e 180, ambas números finitos. Não há endpoint de roteamento presumido nem cálculo de trajetos no navegador.

## Confirmações necessárias

- Corrigir o CORS para a origem confirmada do frontend e verificar novamente GET e preflight OPTIONS.
- Confirmar campos de registros das quatro coleções vazias; contratos POST de IA/mapas, eventuais envelopes/paginação e tipos dos campos.
- Datas civis em `YYYY-MM-DD`; horários referentes a America/Sao_Paulo, não timestamps interpretados no fuso do visitante.
- Filtragem de conteúdo publicado, buckets públicos autorizados e headers CORS das imagens para exportação.
- Provedor e política de uso da geocodificação; limites e duração máxima das chamadas de IA.
- Autorização de fotos e textos antes da publicação; administração protegida apenas fora do site público.

O cliente não envia cookies, CSRF, sessão ou token administrativo. Erros HTTP usam mensagens locais amigáveis; respostas internas do servidor não são exibidas. 429 e 503 possuem mensagens específicas. Não há retry automático de POST: uma tentativa adicional depende de ação do usuário.
