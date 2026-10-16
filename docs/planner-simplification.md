# Planejador sem orçamento e transporte

Foram removidos somente os dois controles do formulário “Onde vamos fazer memórias?” em `index.html`. A grade existente passa a ter cidade em largura total, data e horário na linha seguinte, duração e tipo de passeio na próxima, e preferências/restrições em largura total. Não houve alteração de CSS, cores, fontes, botões, animações ou breakpoints.

`validatePreferences` continua validando os campos restantes e retorna explicitamente apenas os sete campos abaixo. Não há inputs ocultos, valores fictícios de orçamento, transporte padrão ou armazenamento desses campos no navegador. `ai-planner.js` utiliza esse payload validado e mantém o bloqueio de envios concorrentes e a preservação dos dados após falhas.

```json
{
  "cidade": "Belo Horizonte",
  "data": "2026-12-25",
  "inicio": "09:00",
  "duracao": "2",
  "tipo": "Cultural",
  "preferencias": "",
  "restricoes": ""
}
```

## Alterações necessárias no backend

O contrato foi conferido em `../mybae-backend/backend/validators/content.js`: `plannerFieldsSchema` exigia `orcamento` (`z.coerce.number().min(0).max(100000)`) e `transporte` (enum de quatro opções). Esses campos eram validados antes de consultar quotas ou a Groq. Remover apenas os inputs causaria HTTP 400.

O checkout local `mybae-backend` recebeu duas alterações limitadas ao planejador de IA:

1. Em `backend/validators/content.js`, acrescentar `.optional()` a esses dois campos de `plannerFieldsSchema`, sem `.default()`. O orçamento informado por clientes antigos continua limitado a 0–100000 e o transporte informado continua limitado a `A pé`, `Carro`, `Transporte público` ou `Aplicativo`. Os demais validadores e o objeto `.strict()` permanecem. O schema do roteiro manual não foi alterado e continua exigindo seu transporte.
2. Em `backend/services/ai.service.js`, a instrução da IA passa a respeitar orçamento/transporte somente quando explicitamente informados. Sem orçamento, não deve inventar limite nem presumir que o passeio seja gratuito; sem transporte, não deve afirmar uma escolha e deve sugerir confirmar os deslocamentos. O schema da resposta Groq, verificação de cidade/data/horário/duração, limites, quotas e timeout não foram alterados.

O backend é compatível com o formulário anterior, que enviava os dois valores. A sequência de publicação é backend primeiro e frontend depois, ou ambos na mesma entrega coordenada. **Nenhuma publicação foi feita neste trabalho.**

## Verificação na API publicada

Em 16/10/2026, um único `POST /api/ai` ao backend publicado, com o payload acima e `Origin: https://mybae-memories.vercel.app`, retornou:

```json
{"error":"Confira os campos: orcamento, transporte"}
```

Status: **HTTP 400**. A versão publicada ainda exige os campos; essa tentativa é rejeitada antes da Groq e das quotas. Não foram acrescentados campos fictícios nem repetida a geração. Portanto, o teste não confirma uma resposta real do modelo com o contrato novo: a geração após a alteração foi validada localmente pelo handler/adaptador reais com Groq mockada. Uma geração real com o formulário novo só poderá ser confirmada após publicar o ajuste autorizado do backend.

## Testes

```powershell
$env:BROWSER_CHANNEL = 'msedge'
python -m unittest discover -s tests -v
node --test tests/planner-contract.test.mjs tests/manual-itinerary-contract.test.mjs
```

Os testes de navegador verificam ausência dos dois controles, os sete campos restantes, JSON completo, geração renderizada com mock, alinhamento/responsividade e dados preservados em HTTP 400. A suíte anterior cobre os demais fluxos do site.

`tests/planner-contract.test.mjs` utiliza o código real do checkout irmão (ou `MYBAE_BACKEND_DIR`) e mocka todas as chamadas externas. Confirma que o novo payload passa no Zod, que a Groq recebe somente as preferências informadas, que o roteiro retornado passa no validador do frontend, que as três quotas continuam no fluxo e que limites/enums/campos obrigatórios restantes continuam validados. Também verifica que o contrato manual ainda exige transporte. O teste manual anterior continua passando.

Resultado local em 16/10/2026: **52 testes de navegador passaram** no Edge; **7 testes de contrato** (planejador e manual) passaram; **26 testes do backend** (`core`, `planner-maps`, `public-services` e `manual-itinerary`) passaram. A captura do planejador foi inspecionada visualmente. `git diff --check` passou nos dois repositórios. A chamada real ao backend publicado permaneceu em HTTP 400, conforme registrado acima.

O formulário manual, Supabase, calendário, galeria, player musical e módulos de persistência não foram alterados. Não houve push nem deploy.
