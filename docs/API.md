# Contratos observados no frontend

O backend privado não está neste checkout e não foi consultado. As rotas e campos abaixo foram extraídos dos arquivos originais (`api.js`, `main.js`, `gallery.js`, `calendar.js`, `itinerary.js`, `maps.js`). São expectativas de compatibilidade, pendentes de confirmação pelo responsável pelo backend. Não foi presumido envelope `{data: ...}`: as coleções originais esperam arrays diretamente.

| Método | Rota | Resposta esperada |
| --- | --- | --- |
| GET | /api/memorias | Array: titulo, data_memoria (`YYYY-MM-DD`); descricao, categoria, destaque e imagem_url opcionais |
| GET | /api/galeria | Array: imagem_url; legenda, descricao, data_foto (`YYYY-MM-DD`) e created_at opcionais |
| GET | /api/encontros | Array: id, titulo, data_encontro (`YYYY-MM-DD`), horario_inicio (`HH:mm` ou `HH:mm:ss`); horario_fim, cidade, local, endereco, descricao, preferencias, orcamento e status opcionais |
| GET | /api/configuracoes | Array; usa o primeiro registro: nome_pessoa_1, nome_pessoa_2, mensagem_principal, imagem_capa, data_inicio_relacionamento opcionais. Nome oficial My Bae permanece fixo |
| GET | /api/roteiros | Array: titulo, dados_json (objeto de roteiro); encontro_id opcional |
| POST | /api/ai | Objeto de roteiro |
| POST | /api/mapas | Array: nome (endereço exibido), latitude e longitude numéricas e válidas |

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

- URL pública real do backend e suporte CORS à origem do frontend e preflight OPTIONS.
- Existência dessas sete rotas, métodos e formatos; eventuais envelopes/paginação e tipos dos campos.
- Datas civis em `YYYY-MM-DD`; horários referentes a America/Sao_Paulo, não timestamps interpretados no fuso do visitante.
- Filtragem de conteúdo publicado, buckets públicos autorizados e headers CORS das imagens para exportação.
- Provedor e política de uso da geocodificação; limites e duração máxima das chamadas de IA.
- Autorização de fotos e textos antes da publicação; administração protegida apenas fora do site público.

O cliente não envia cookies, CSRF, sessão ou token administrativo. Erros HTTP usam mensagens locais amigáveis; respostas internas do servidor não são exibidas. 429 e 503 possuem mensagens específicas. Não há retry automático de POST: uma tentativa adicional depende de ação do usuário.
