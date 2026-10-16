// Uses the real local backend code with Groq and quota requests mocked.
import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validatePreferences, validateResponse } from "../js/utils/validators.js";

const backend = process.env.MYBAE_BACKEND_DIR || fileURLToPath(new URL("../../mybae-backend/", import.meta.url));
const { plannerSchema, manualItinerarySubmissionSchema } = await import(pathToFileURL(resolve(backend, "backend/validators/content.js")));
const { default: ai } = await import(pathToFileURL(resolve(backend, "api/ai.js")));
const fields = {
  cidade: " Belo Horizonte ", data: "2026-12-25", inicio: "09:00", duracao: "4",
  tipo: "Natureza", preferencias: "Parque tranquilo", restricoes: "Evitar escadas",
};
const result = {
  titulo: "Um dia nosso", descricao: "Sugestões para o casal", resumo: "Um dia especial",
  observacoes: "Conferir funcionamento", cidade: "Belo Horizonte", data: fields.data,
  inicio: "09:00", fim: "13:00", chuva: "Museu", plano_alternativo_chuva: "Visita coberta",
  alimentacao: "Conferir opções no local", custos: "Valores a confirmar", recomendacoes: [],
  etapas: [
    { ordem: 1, nome: "Parque", horario: "09:00", descricao: "Passear", busca: "Parque Belo Horizonte",
      endereco_sugerido: "Parque Belo Horizonte", tipo_atividade: "Natureza", custo_estimado: null },
    { ordem: 2, nome: "Café", horario: "12:00", descricao: "Conversar", busca: "Café Belo Horizonte",
      endereco_sugerido: "Café Belo Horizonte", tipo_atividade: "Alimentação", custo_estimado: null },
  ],
};

test("frontend envia só os sete campos restantes; backend aceita sem inventar valores", () => {
  const payload = validatePreferences({ ...fields, orcamento: "999", transporte: "Carro", extra: "ignore" }, "2026-10-16");
  assert.deepEqual(payload, { ...fields, cidade: "Belo Horizonte" });
  const parsed = plannerSchema.parse(payload);
  assert.equal(Object.hasOwn(parsed, "orcamento"), false);
  assert.equal(Object.hasOwn(parsed, "transporte"), false);
  assert.equal(parsed.duracao, 4);
});

test("validações remanescentes e validações legadas de orçamento/transporte continuam ativas", () => {
  const payload = validatePreferences(fields, "2026-10-16");
  for (const patch of [
    { cidade: "x" }, { data: "2026-02-30" }, { inicio: "25:00" }, { duracao: "13" },
    { tipo: "desconhecido" }, { preferencias: "x".repeat(801) }, { restricoes: "x".repeat(801) },
    { orcamento: -1 }, { orcamento: 100001 }, { orcamento: "inválido" }, { transporte: "avião" },
    { publicado: true },
  ]) assert.equal(plannerSchema.safeParse({ ...payload, ...patch }).success, false);
  assert.equal(plannerSchema.parse({ ...payload, orcamento: "150", transporte: "Carro" }).orcamento, 150);
  const manual = {
    titulo: "Encontro", cidade: "Belo Horizonte", data_encontro: fields.data,
    horario_inicio: "09:00", horario_fim: "13:00", descricao: "Dia especial", tipo_passeio: "Natureza",
    etapas: result.etapas.map((stage) => ({ ordem: stage.ordem, horario: stage.horario, nome: stage.nome, descricao: stage.descricao })),
  };
  assert.equal(manualItinerarySubmissionSchema.safeParse(manual).success, false);
  assert.equal(manualItinerarySubmissionSchema.safeParse({ ...manual, transporte: "Carro" }).success, true);
});

test("formulário → endpoint real → adaptador Groq → roteiro validado, sem orçamento/transporte", async () => {
  Object.assign(process.env, {
    APP_ORIGIN: "https://frontend.example", SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "test-server-key", RATE_LIMIT_SECRET: "r".repeat(48),
    AI_PROVIDER: "groq", GROQ_API_KEY: "test-groq-key",
  });
  const originalFetch = globalThis.fetch;
  let quotas = 0, generations = 0;
  globalThis.fetch = async (address, options) => {
    const url = new URL(address);
    if (url.hostname === "example.supabase.co") {
      assert.equal(url.pathname, "/rest/v1/rpc/consume_quota");
      quotas++;
      return Response.json(true);
    }
    assert.equal(url.href, "https://api.groq.com/openai/v1/chat/completions");
    assert.equal(options.headers.Authorization, "Bearer test-groq-key");
    const body = JSON.parse(options.body);
    const preferences = JSON.parse(body.messages[1].content);
    assert.deepEqual(preferences, { ...fields, cidade: "Belo Horizonte", duracao: 4 });
    assert.equal(body.response_format.json_schema.strict, true);
    assert.match(body.messages[0].content, /When budget is absent, do not invent/);
    assert.match(body.messages[0].content, /When transport is absent, do not assume/);
    generations++;
    return Response.json({ choices: [{ message: { content: JSON.stringify(result) } }] });
  };
  try {
    const response = { code: 200, setHeader() {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; } };
    await ai({ method: "POST", headers: { origin: process.env.APP_ORIGIN, "content-type": "application/json" },
      socket: { remoteAddress: "127.0.0.1" }, body: validatePreferences(fields, "2026-10-16") }, response);
    assert.equal(response.code, 200);
    const itinerary = validateResponse("ai", response.data);
    assert.equal(itinerary.titulo, result.titulo);
    assert.deepEqual(itinerary.etapas.map((stage) => stage.nome), ["Parque", "Café"]);
    assert.equal(quotas, 3);
    assert.equal(generations, 1);
  } finally { globalThis.fetch = originalFetch; }
});
