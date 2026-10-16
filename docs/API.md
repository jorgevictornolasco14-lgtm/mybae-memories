# Contratos e integração do backend

Backend público: `https://mybae-backend-seven.vercel.app`, centralizado em `js/config.js`. Verificação real em 15/10/2026 (America/Sao_Paulo): `GET /api/configuracoes` sem `Origin` retornou HTTP 200 com um array de um registro. Campos observados: `id`, `nome_site`, `nome_pessoa_1`, `nome_pessoa_2`, `data_inicio_relacionamento` (null), `mensagem_principal`, `imagem_capa` (string vazia), `created_at` e `updated_at`. O cliente usa `rows[0]`, valida os tipos públicos e mantém os textos padrão para campos ausentes ou vazios. Não existe envelope `{data: ...}`.

As outras quatro coleções abaixo foram consultadas via GET e retornaram HTTP 200 com `[]`. Isso confirma rota, método e array vazio, mas **não confirma os campos de registros, paginação ou vínculos**. As chamadas e validadores existentes foram preservados até haver registros públicos representativos ou documentação do backend. Os POSTs de IA e mapas não foram acionados nesta verificação; seus contratos abaixo continuam sendo expectativas do frontend original.

| Método | Rota | Resposta esperada |
| --- | --- | --- |
| GET | /api/memorias | Array: titulo, data_memoria (`YYYY-MM-DD`); descricao, categoria, destaque e imagem_url opcionais |
| GET | /api/galeria | Confirmado: array com id, storage_path, legenda, descricao, data_foto, publicado, created_at, updated_at, imagem_url e url |
| GET | /api/encontros | Array: id, titulo, data_encontro (`YYYY-MM-DD`), horario_inicio (`HH:mm` ou `HH:mm:ss`); horario_fim, cidade, local, endereco, descricao, preferencias, orcamento e status opcionais |
| GET | /api/configuracoes | Confirmado: array; primeiro registro com nome_site, nome_pessoa_1, nome_pessoa_2, mensagem_principal, imagem_capa e data_inicio_relacionamento opcionais |
| GET | /api/roteiros | Array: titulo, dados_json (objeto de roteiro); encontro_id opcional |
| POST | /api/ai | Objeto de roteiro |
| POST | /api/mapas | Array: nome (endereço exibido), latitude e longitude numéricas e válidas |

## Cadastro de memórias

Verificação em 16/10/2026: `GET /api/memorias` respondeu HTTP 200 com `[]`. O preflight para `POST /api/memorias` inicialmente retornou 405; às 02:51 UTC respondeu 204 e autorizou POST. Um POST de `{}` retornou HTTP 400 com a validação `Confira os campos: titulo, descricao, data_memoria`, confirmando os nomes do payload sem criar registro. O frontend envia esses três campos e exige HTTP 201 para mostrar sucesso. Nenhum registro de teste foi publicado; o GET seguinte continuou retornando `[]`.

## CORS e upload da galeria

Verificação HTTP em 15/10/2026 (America/Sao_Paulo): `GET /api/galeria` retornou HTTP 200 com dois registros publicados, inclusive com `Origin: https://mybae-memories.vercel.app`. A resposta é um array JSON direto. Cada registro observado inclui `imagem_url` e `url` como URLs assinadas do Supabase Storage; os tokens observados expiram em aproximadamente cinco minutos. O preflight OPTIONS para POST nessa origem retornou 204 e autorizou `GET`, `POST` e o header `Content-Type`. A origem de produção está autorizada no momento da verificação.

A interface envia `POST /api/galeria` como `multipart/form-data`, com `file`, `legenda`, `descricao` e `data_foto`; o limite local é 2,8 MiB. O POST não foi repetido nesta verificação para evitar publicar arquivo de teste. Após resposta 2xx, o cliente consulta novamente a lista sem cache.

O frontend usa `mode: "cors"`, `credentials: "omit"` e não envia tokens. GET e OPTIONS da origem publicada passaram; uma publicação real ainda depende de o endpoint aceitar o multipart descrito acima. O backend e seu deploy não foram alterados neste repositório.

## Cadastro de encontros e roteiros manuais

Verificação HTTP em 16/10/2026 às 03:46 UTC, com `Origin: https://mybae-memories.vercel.app`: `GET /api/encontros` respondeu HTTP 200 com um array vazio. O preflight `OPTIONS` para `POST /api/encontros` respondeu HTTP 405 e `Allow: GET`; não há contrato de gravação confirmado. O frontend manual pode compor e pré-visualizar um roteiro no componente existente, mas não deve afirmar que salvou nem atualizar o calendário até que o backend publique o POST e documente o payload e a resposta de sucesso.

## Exclusão administrativa

Verificação HTTP em 16/10/2026 às 03:37 UTC, com `Origin: https://mybae-memories.vercel.app`: o preflight `OPTIONS` solicitando `DELETE` em `/api/galeria` e `/api/memorias` respondeu HTTP 405, com `Allow: GET, POST`. As rotas por registro `/api/galeria/{id}` e `/api/memorias/{id}` responderam 404 da Vercel. `/api/admin/session` e `/api/admin` também responderam 404. Portanto, o backend publicado não confirma endpoints DELETE nem uma sessão administrativa temporária; este frontend não deve exibir controles de exclusão nem tentar contornar essa ausência.

Para habilitar a funcionalidade com segurança, o backend precisa publicar e documentar uma forma de autorização administrativa temporária, sem segredo permanente no JavaScript, e endpoints DELETE específicos para cada registro. Deve validar a autorização no servidor, responder ao preflight CORS para os métodos e cabeçalhos necessários e retornar sucesso/erros previsíveis. Depois disso, o frontend pode integrar o contrato, apresentar confirmação e remover o card somente após confirmação HTTP do servidor.

Reproduzir a verificação HTTP:

```powershell
curl.exe -i -H "Origin: https://mybae-memories.vercel.app" https://mybae-backend-seven.vercel.app/api/configuracoes
curl.exe -i -X OPTIONS -H "Origin: https://mybae-memories.vercel.app" -H "Access-Control-Request-Method: GET" https://mybae-backend-seven.vercel.app/api/configuracoes
```

Após a correção, servir o frontend localmente, verificar em Network que `/api/configuracoes` retorna 200 legível pelo navegador e conferir título, marcas, nomes e mensagem contra o primeiro registro. Repetir da origem publicada após um deploy autorizado. Para galeria, memórias, encontros e roteiros, confirmar os campos com registros reais antes de alterar mapeamentos; não inserir dados de teste no banco de produção para inferir contratos.

Validação local: a suíte `tests/test_frontend.py` inclui respostas simuladas; consulte o resultado mais recente ao executar. Nenhum login, chave Supabase, commit, push ou deploy foi adicionado/executado nesta integração.

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
