# Último roteiro publicado na seção principal

O frontend consulta `GET /api/roteiros` com `cache: "no-store"` ao abrir a página. O contrato é um array JSON direto. A rota do backend filtra `publicado=true` e ordena por `created_at` decrescente; o cliente seleciona o primeiro registro e preserva a ordem da lista. A data do encontro e `updated_at` não são critérios para a seleção inicial. Não existe campo `published_at` nesse contrato.

Fonte consultada: `api/roteiros.js` e `backend/repositories/content.repository.js` do checkout irmão `mybae-backend`. Durante o trabalho foram observadas alterações paralelas nesse backend que acrescentam desempate por `id` decrescente e projeção de roteiros completos; o frontend mantém a ordem recebida em ambos os casos. Nenhuma alteração ao backend foi necessária neste trabalho.

Em 16/10/2026, uma consulta somente de leitura à API publicada, com `Origin: https://mybae-memories.vercel.app`, retornou HTTP 200 com um registro publicado e os campos `id`, `encontro_id`, `titulo`, `descricao`, `dados_json`, `versao`, `publicado`, `created_at` e `updated_at`. Isso confirma a forma da resposta publicada; a ordenação entre múltiplos registros também foi conferida no código do backend e nos testes com mocks.

## Comportamento

- O componente existente renderiza `dados_json`: título, descrição, cidade, data, início/fim, transporte, etapas na ordem recebida, buscas/endereços e `imagem_url` aceita por `safeImage`.
- O exemplo “Nosso domingo, sem pressa” foi removido. Carregamento, ausência de registros e erro usam classes existentes. O estado vazio abre o formulário manual; o erro permite tentar novamente. Sem roteiro renderizado, os controles de visualização e exportação ficam desabilitados.
- Um POST manual só altera o principal e a lista após HTTP 201 e validação da resposta. O evento `mybae:meeting-created` mantém `id` e `date` para o calendário e acrescenta o registro `roteiro` confirmado. Em seguida a lista é atualizada sem cache. Falhas nessa leitura mantêm o roteiro recém-confirmado e oferecem nova tentativa, sem repetir o POST.
- Respostas iniciadas antes do cadastro não substituem o novo roteiro. Uma resposta inicial atrasada também respeita uma prévia que a pessoa já abriu. Depois de recarregar/reabrir, a seleção inicial volta a ser o último publicado consultado no servidor, sem depender de localStorage.
- Modo Interativo/Pôster, lista de roteiros, calendário, prévias manuais, Groq, mapas e exportação reutilizam os módulos existentes. As imagens de outras seções e os arquivos de CSS não foram alterados.

## Fotografias

O principal publicado usa os dados retornados pelo servidor, incluindo fotografias persistidas. Arquivos selecionados no formulário manual continuam disponíveis para a prévia, mas o contrato JSON atual não faz upload desses arquivos. O salvamento informa isso e não apresenta uma URL temporária `blob:` como foto persistida. Ausência ou falha de imagem usa o placeholder já existente. Imagens remotas precisam permitir CORS para a exportação PNG/PDF.

## Testes

```powershell
$env:BROWSER_CHANNEL = 'msedge'
python -m unittest discover -s tests -v
```

A suíte usa APIs e tiles mockados, bibliotecas reais e downloads reais de PNG/PDF. Cobre carregamento sem exibir o exemplo, múltiplos registros, prioridade da ordem da API sobre datas futuras/edições, escolha na lista, reabertura, estado vazio, falhas HTTP/JSON/rede e retry, espera pelo HTTP 201, atualização após cadastro, respostas antigas em trânsito, falha da lista após sucesso, prévia manual, imagem persistida/ausente, endereços e marcadores preservados entre modos. Os testes anteriores cobrem também calendário, formulário manual, IA, responsividade, navbar, player, galeria e memórias.

Resultado em 16/10/2026: **50 testes de navegador passaram** no Edge, incluindo os downloads reais de PNG/PDF. O PNG exportado também foi inspecionado visualmente. Passaram ainda os 4 testes de contrato frontend/backend em `tests/manual-itinerary-contract.test.mjs` e 17 testes mockados de roteiros, cadastro manual e contratos no checkout do backend. Após a implementação, a resposta de um GET real foi aprovada por `validateResponse("roteiros", ...)` do frontend (HTTP 200, um registro publicado com etapas). `git diff --check` passou.

Não houve POST de teste em produção, push ou deploy.
