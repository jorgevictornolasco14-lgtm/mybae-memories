# Contratos e integração do backend

Backend público: `https://mybae-backend-seven.vercel.app`, centralizado em `js/config.js`. Verificação real em 15/10/2026 (America/Sao_Paulo): `GET /api/configuracoes` sem `Origin` retornou HTTP 200 com um array de um registro. Campos observados: `id`, `nome_site`, `nome_pessoa_1`, `nome_pessoa_2`, `data_inicio_relacionamento` (null), `mensagem_principal`, `imagem_capa` (string vazia), `created_at` e `updated_at`. O cliente usa `rows[0]`, valida os tipos públicos e mantém os textos padrão para campos ausentes ou vazios. Não existe envelope `{data: ...}`.

As outras quatro coleções abaixo foram consultadas via GET e retornaram HTTP 200 com `[]`. Isso confirma rota, método e array vazio, mas **não confirma os campos de registros, paginação ou vínculos**. As chamadas e validadores existentes foram preservados até haver registros públicos representativos ou documentação do backend. Os POSTs de IA e mapas não foram acionados nesta verificação; seus contratos abaixo continuam sendo expectativas do frontend original.

| Método | Rota | Resposta esperada |
| --- | --- | --- |
| GET | /api/memorias | Array: titulo, data_memoria (`YYYY-MM-DD`); descricao, categoria, destaque e imagem_url opcionais |
| GET | /api/galeria | Confirmado: array com id, storage_path, legenda, descricao, data_foto, publicado, created_at, updated_at, imagem_url e url |
| GET | /api/encontros | Array: id, titulo, data_encontro (`YYYY-MM-DD`), horario_inicio (`HH:mm` ou `HH:mm:ss`); horario_fim, cidade, local, endereco, descricao, preferencias, orcamento e status opcionais |
| GET | /api/configuracoes | Confirmado: array; primeiro registro com nome_site, nome_pessoa_1, nome_pessoa_2, mensagem_principal, imagem_capa e data_inicio_relacionamento opcionais |
| GET | /api/roteiros | Array de registros publicados em ordem de `created_at` decrescente: id, encontro_id, titulo, descricao, dados_json, versao, publicado, created_at e updated_at |
| POST | /api/ai | Objeto de roteiro |
| POST | /api/mapas | Array: nome (endereço exibido), latitude e longitude numéricas e válidas |

## Cadastro de memórias

Verificação em 16/10/2026: `GET /api/memorias` respondeu HTTP 200 com `[]`. O preflight para `POST /api/memorias` inicialmente retornou 405; às 02:51 UTC respondeu 204 e autorizou POST. Um POST de `{}` retornou HTTP 400 com a validação `Confira os campos: titulo, descricao, data_memoria`, confirmando os nomes do payload sem criar registro. O frontend envia esses três campos e exige HTTP 201 para mostrar sucesso. Nenhum registro de teste foi publicado; o GET seguinte continuou retornando `[]`.

## CORS e upload da galeria

Verificação HTTP em 15/10/2026 (America/Sao_Paulo): `GET /api/galeria` retornou HTTP 200 com dois registros publicados, inclusive com `Origin: https://mybae-memories.vercel.app`. A resposta é um array JSON direto. Cada registro observado inclui `imagem_url` e `url` como URLs assinadas do Supabase Storage; os tokens observados expiram em aproximadamente cinco minutos. O preflight OPTIONS para POST nessa origem retornou 204 e autorizou `GET`, `POST` e o header `Content-Type`. A origem de produção está autorizada no momento da verificação.

A interface envia `POST /api/galeria` como `multipart/form-data`, com `file`, `legenda`, `descricao` e `data_foto`; o limite local é 2,8 MiB. O POST não foi repetido nesta verificação para evitar publicar arquivo de teste. Após resposta 2xx, o cliente consulta novamente a lista sem cache.

O frontend usa `mode: "cors"`, `credentials: "omit"` e não envia tokens. GET e OPTIONS da origem publicada passaram; uma publicação real ainda depende de o endpoint aceitar o multipart descrito acima. O backend e seu deploy não foram alterados neste repositório.

## Cadastro de encontros e roteiros manuais

Verificação HTTP histórica em 16/10/2026 às 03:46 UTC, com `Origin: https://mybae-memories.vercel.app`: `GET /api/encontros` respondeu HTTP 200 com um array vazio; o preflight POST respondeu HTTP 405 e `Allow: GET` naquele momento. A análise posterior do checkout local `mybae-backend` confirmou a implementação de POST e o contrato em `manualItinerarySubmissionSchema`, usado pela rota pública. Sucesso exige HTTP 201 com `{ success: true, encontro, roteiro }`. São aceitas de 2 a 9 etapas, na ordem sequencial, com início de cada etapa estritamente anterior ao término do encontro. Veja o [diagnóstico, payload completo e testes com o Zod real](manual-itinerary-http400.md). Esses testes usam dependências mockadas e não comprovam a versão publicada em produção.

## Exclusão administrativa

Exclusão administrativa (verificada em 16/10/2026): o repositório local `mybae-backend` implementa exclusão protegida por capacidade temporária (detalhes em `docs/admin-delete-capabilities.md` naquele repositório). O contrato é `DELETE /api/galeria?id=<uuid>` e `DELETE /api/memorias` com JSON `{"id":"<uuid>"}`, ambos com header `X-Admin-Capability`. A capacidade é de uso único, vinculada ao UUID e expira em 10 minutos. O sucesso é HTTP 200 com `{ "success": true, "deleted": boolean }`. Para fotos, o backend remove o objeto pelo Storage API antes de excluir o registro PostgreSQL; falhas mantêm o registro para nova tentativa.

Na verificação live, o preflight CORS aceitou `DELETE` e `X-Admin-Capability`. Sem capacidade, a rota de fotos respondeu 401. Um token de formato válido usado sem credencial de item real respondeu 503 `MISSING_ADMIN_CAPABILITY_SECRET`, indicando que `ADMIN_CAPABILITY_SECRET` não está configurado no deployment consultado. A rota live de memórias respondeu 500 até para solicitação não autorizada. Nenhuma capacidade válida foi emitida e nenhum registro real foi alterado. Exclusões reais ficam indisponíveis até configurar esse segredo no Vercel e corrigir/verificar o 500 da rota de memórias.

O frontend não guarda segredo administrativo. O operador escolhe o item, executa o comando de emissão no repositório backend e informa a capacidade de uso único; ela fica apenas em memória na página e é consumida ao confirmar. Sem UUID válido não há botão de lixeira. O card só sai da interface após HTTP de sucesso; em falha permanece visível e é necessária uma nova capacidade.

Reproduzir a verificação HTTP:

```powershell
curl.exe -i -H "Origin: https://mybae-memories.vercel.app" https://mybae-backend-seven.vercel.app/api/configuracoes
curl.exe -i -X OPTIONS -H "Origin: https://mybae-memories.vercel.app" -H "Access-Control-Request-Method: GET" https://mybae-backend-seven.vercel.app/api/configuracoes
```

Após a correção, servir o frontend localmente, verificar em Network que `/api/configuracoes` retorna 200 legível pelo navegador e conferir título, marcas, nomes e mensagem contra o primeiro registro. Repetir da origem publicada após um deploy autorizado. Para galeria, memórias, encontros e roteiros, confirmar os campos com registros reais antes de alterar mapeamentos; não inserir dados de teste no banco de produção para inferir contratos.

Validação local: a suíte `tests/test_frontend.py` inclui respostas simuladas; consulte o resultado mais recente ao executar. Nenhum login, chave Supabase, commit, push ou deploy foi adicionado/executado nesta integração.

## Formulário de IA

JSON contém somente os sete campos do planejador simplificado, preservando seus valores textuais:

```json
{
  "cidade": "Cidade de teste",
  "data": "2026-12-01",
  "inicio": "09:00",
  "duracao": "4",
  "tipo": "Romântico",
  "preferencias": "",
  "restricoes": ""
}
```

Orçamento e transporte não são enviados. O ajuste local no backend torna `plannerFieldsSchema.orcamento` e `plannerFieldsSchema.transporte` opcionais, sem defaults, preservando os limites e enums para clientes que ainda os informem. Os demais campos, validação da resposta, limites de uso e timeout permanecem. A chamada é pública e não permite escrita administrativa. **O endpoint publicado consultado em 16/10/2026 ainda retornou HTTP 400 `Confira os campos: orcamento, transporte` para esse novo payload**; o ajuste do backend precisa ser publicado antes ou junto do frontend. Veja [detalhes e testes](planner-simplification.md).

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
