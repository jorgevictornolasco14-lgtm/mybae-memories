# Diagnóstico do HTTP 400 ao guardar roteiro manual

Análise em 16/10/2026, usando o código local de `mybae-memories` e do checkout irmão `mybae-backend`. Não foram enviados POSTs a produção. Sem o corpo da requisição e da resposta originais, a causa daquele envio específico não pode ser afirmada; o caso abaixo foi reproduzido no endpoint e no Zod reais, com dependências mockadas.

## Rejeição reproduzida

O formulário e a prévia aceitavam a sétima etapa em `14:00` com `horario_fim: "14:00"`. A importação de um backup sem `manual_fim` preenche exatamente esse valor a partir da última etapa, preservando a ordem original.

Em `mybae-backend/backend/validators/content.js`, `manualItinerarySubmissionSchema.superRefine` rejeita uma etapa quando `at < start || at >= end`, ou quando seu horário é anterior ao da etapa precedente. Portanto, a etapa precisa começar **antes** do término. O problema não é a quantidade: o schema admite de 2 a 9 etapas.

Resultado confirmado de `POST /api/encontros` no handler local, antes de consumir quota ou acessar persistência:

```json
{"error":"Confira os campos: etapas.6.horario"}
```

O índice 6 corresponde à etapa 7. O frontend anterior verificava `step.horario > horario_fim`, permitindo igualdade. `js/api.js` descartava o campo rejeitado e substituía a resposta pela mensagem genérica relatada. A validação HTML verifica campos individuais; não garante essas regras entre horários. O HTTP 400 reproduzido é emitido pela validação Zod do backend, não pelo navegador.

O salvamento agora impede esse envio e informa a etapa e o horário final a ajustar. Não modifica automaticamente horários, não remove nem reordena etapas. A prévia de backups continua disponível; para publicar, é necessário informar um término posterior à última etapa.

## Payload enviado pelo formulário

O corpo é JSON direto, sem envelope `data`, com `Content-Type: application/json`. Exemplo sintético de sete etapas após ajustar o término:

```json
{
  "titulo": "Roteiro de sete etapas",
  "cidade": "Belo Horizonte",
  "data_encontro": "2027-01-15",
  "horario_inicio": "08:00",
  "horario_fim": "14:30",
  "descricao": "Dia especial",
  "tipo_passeio": "Personalizado",
  "transporte": "A pé",
  "etapas": [
    {"ordem": 1, "horario": "08:00", "nome": "Local 1", "descricao": "Atividade 1", "endereco": "Rua de teste 1, 100"},
    {"ordem": 2, "horario": "09:00", "nome": "Local 2", "descricao": "Atividade 2", "endereco": "Rua de teste 2, 100"},
    {"ordem": 3, "horario": "10:00", "nome": "Local 3", "descricao": "Atividade 3", "endereco": "Rua de teste 3, 100"},
    {"ordem": 4, "horario": "11:00", "nome": "Local 4", "descricao": "Atividade 4", "endereco": "Rua de teste 4, 100"},
    {"ordem": 5, "horario": "12:00", "nome": "Local 5", "descricao": "Atividade 5", "endereco": "Rua de teste 5, 100"},
    {"ordem": 6, "horario": "13:00", "nome": "Local 6", "descricao": "Atividade 6", "endereco": "Rua de teste 6, 100"},
    {"ordem": 7, "horario": "14:00", "nome": "Local 7", "descricao": "Atividade 7", "endereco": "Rua de teste 7, 100"}
  ]
}
```

`buildManualItineraryPayload` mantém o mapeamento anterior: `data → data_encontro`, `inicio → horario_inicio`, `fim → horario_fim`, `busca → endereco`. `ordem` é número inteiro `index + 1` na ordem atual do formulário, sem ordenação automática. Os outros valores enviados são strings. O transporte é normalizado para o enum já existente. Fotografias locais e URLs `blob:` não integram o JSON.

## Comparação com o contrato real

A rota `mybae-backend/api/encontros.js` chama `createManualItinerary`, que primeiro aplica `manualItinerarySubmissionSchema`; depois compõe e valida `itinerarySchema` em `makeRoute`. O schema administrativo `contentSchemas.encontros` não é o contrato desse POST público.

| Campo | Contrato do POST público | Formulário/payload |
| --- | --- | --- |
| `titulo` | string após trim, 1–150 | 2–100 no formulário; enviado após trim |
| `cidade` | string após trim, 2–100 | mesmo limite; agora verifica mínimo após trim |
| `data_encontro` | data civil real `YYYY-MM-DD` | string, sem conversão de fuso/timestamp; frontend também exige hoje ou depois |
| `horario_inicio`, `horario_fim` | `HH:mm` ou `HH:mm:00`, normalizado para `HH:mm`; fim maior que início | inputs de horário; strings `HH:mm` usuais |
| `descricao` | string até 3000 | obrigatório, até 1000; trim no envio |
| `tipo_passeio` | enum que inclui `Personalizado` | string fixa `Personalizado` |
| `transporte` | `A pé`, `Carro`, `Transporte público`, `Aplicativo` | convertido para um desses valores |
| `etapas` | array de 2–9 | prévia/importação permitem 1–30; guardar exige 2–9 |
| `etapas[i].ordem` | inteiro 1–9, igual a `i + 1` | número, sem strings numéricas |
| `etapas[i].horario` | formato de horário acima; início ≤ etapa < fim; horários não decrescentes | agora bloqueia igualdade com término ao guardar |
| `etapas[i].nome` | string após trim, 1–150 | 2–120 no formulário |
| `etapas[i].descricao` | string após trim, 1–1000 | obrigatório, até 500; agora rejeita só espaços com mensagem específica |
| `etapas[i].endereco` | opcional, string até 400, padrão vazio | obrigatório, 4–300; compatível também com os campos derivados `busca` e `endereco_sugerido` (2–300) do segundo schema |
| `imagem_url` e `duracao_estimada_minutos` | opcionais; imagem permanente `/assets/`; duração inteira 1–360 dentro do encontro | não enviados pelo formulário atual |

Os schemas são estritos e rejeitam nomes adicionais. Não foram acrescentados campos administrativos, aliases, coerções ou alterações ao backend. Outros clientes podem passar no schema de entrada e falhar no segundo schema: por exemplo, título acima de 120 caracteres ou endereço acima de 300. Os limites atuais deste formulário já evitam esses casos.

## Mensagens e preservação

Para HTTP 400, o cliente reconhece `issues` com caminhos conhecidos e apresenta as mensagens específicas de validação como texto. Na resposta anterior `Confira os campos: ...`, traduz os caminhos para mensagens locais. Exemplo: `etapas.6.horario` vira `Etapa 7: use HH:mm, na ordem das etapas, a partir do início e antes do término do encontro.` Caminhos desconhecidos e respostas não estruturadas mantêm a mensagem genérica.

Erros não limpam o formulário, não substituem etapas, não removem fotografias selecionadas e não emitem o evento de cadastro. O botão é liberado para correção e nova tentativa, sem retry automático. O sucesso continua exigindo HTTP 201 e uma resposta válida.

## Reprodução dos testes

```powershell
# Navegador instalado no Windows; todas as APIs de dados usam mocks.
$env:BROWSER_CHANNEL = 'msedge'
python -m unittest discover -s tests -v

# Exige checkout ../mybae-backend com suas dependências instaladas.
# MYBAE_BACKEND_DIR pode apontar para outro caminho do checkout real.
node --test tests/manual-itinerary-contract.test.mjs
```

Os testes Node usam o gerador de payload do frontend, o Zod real e o handler real do backend, com `fetch` mockado para quotas e RPC. Reproduzem 400 em `etapas.6.horario`, confirmam zero chamadas a dependências na rejeição e 201 após corrigir o término, mantendo a sequência das sete etapas. Também verificam tipos, campos desconhecidos e formatos de datas/horários. Os testes de navegador verificam o bloqueio antes do POST, o JSON completo enviado, mensagens específicas, preservação de todos os textos e da fotografia após 400, e nova tentativa.

Resultado local em 16/10/2026: 36 testes de navegador passaram no Edge. Após integrar o caso de resposta detalhada, os 3 testes de salvamento foram executados novamente e passaram. Também passaram os 4 testes de contrato deste repositório e os 7 testes de `mybae-backend/tests/manual-itinerary.test.js`. O Chromium gerenciado pelo Playwright não estava instalado; foi usado o canal Edge já disponível. `git diff --check` passou.

Este trabalho não precisou alterar o backend. Durante a execução, foram observadas alterações paralelas em `api/encontros.js`, `backend/utils/http.js` e `backend/validators/content.js`, acrescentando `issues: [{ path, message }]` às respostas de validação e mensagens por regra. Essas alterações foram preservadas; o cliente aceita os dois formatos de erro. A restrição que rejeita o caso continua sendo exatamente `at >= end`, no caminho `etapas.6.horario`. Design, calendário, galeria e IA não foram alterados. Não houve push nem deploy.
