// Run with the real backend checkout alongside this repo (or MYBAE_BACKEND_DIR).
// Every dependency call is mocked; this never contacts a deployed service.
import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { buildManualItineraryPayload } from "../js/features/manual-itinerary.js";

const backend = process.env.MYBAE_BACKEND_DIR || fileURLToPath(new URL("../../mybae-backend/", import.meta.url));
const { manualItinerarySubmissionSchema } = await import(pathToFileURL(resolve(backend, "backend/validators/content.js")));
const { default: handler } = await import(pathToFileURL(resolve(backend, "api/encontros.js")));
const itinerary = {
  titulo: "Roteiro de sete etapas", cidade: "Belo Horizonte", data: "2027-01-15",
  inicio: "09:00", fim: "17:00", descricao: "Dia especial", transporte: "a pé",
  etapas: ["09:00", "09:30", "10:00", "11:00", "11:45", "15:30", "16:30"].map((horario, i) => ({
    horario, nome: ["Praça Sete", "Praça da Liberdade", "Jardins do Palácio da Liberdade", "Shopping Cidade", "Parque Municipal", "Cinema", "Sorvete"][i],
    descricao: `Atividade ${i + 1}`, busca: `Rua de teste ${i + 1}, 100`, imagem_url: "blob:local-photo",
  })),
};

test("o payload real do frontend passa no Zod sem reordenar as sete etapas", () => {
  const payload = buildManualItineraryPayload(itinerary);
  assert.equal(manualItinerarySubmissionSchema.safeParse(payload).success, true);
  assert.deepEqual(payload.etapas.map((stage) => stage.ordem), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(payload.etapas.map((stage) => stage.nome), itinerary.etapas.map((stage) => stage.nome));
  assert.equal(payload.transporte, "A pé");
  assert.ok(payload.etapas.every((stage) => !Object.hasOwn(stage, "imagem_url")));
});

test("o Zod rejeita a última etapa igual ao término em etapas.6.horario; o frontend impede o POST", () => {
  const original = structuredClone(itinerary);
  const payload = { ...buildManualItineraryPayload(itinerary), horario_fim: "16:30" };
  const result = manualItinerarySubmissionSchema.safeParse(payload);
  assert.equal(result.success, false);
  assert.deepEqual(result.error.issues.map((issue) => issue.path), [["etapas", 6, "horario"]]);
  assert.throws(() => buildManualItineraryPayload({ ...itinerary, fim: "16:30" }), /Etapa 7:.*anterior ao término.*Horário de término:.*posterior a 16:30/);
  assert.deepEqual(itinerary, original);
});

test("contrato real exige nomes, tipos, data civil, horários e ordem sequencial", () => {
  const payload = buildManualItineraryPayload(itinerary);
  for (const changed of [
    { ...payload, data_encontro: "2027-02-30" },
    { ...payload, data_encontro: "2027-01-15T08:00:00Z" },
    { ...payload, horario_inicio: "8:00" },
    { ...payload, horario_inicio: "08:00:01" },
    { ...payload, transporte: "a pé" },
    { ...payload, cidade: " B " },
    { ...payload, publicado: true },
    { ...payload, etapas: payload.etapas.map((stage, i) => i === 6 ? { ...stage, ordem: "7" } : stage) },
    { ...payload, etapas: [...payload.etapas].reverse() },
    { ...payload, etapas: payload.etapas.map((stage, i) => i === 6 ? { ...stage, busca: stage.endereco } : stage) },
  ]) assert.equal(manualItinerarySubmissionSchema.safeParse(changed).success, false);
  const seconds = manualItinerarySubmissionSchema.parse({ ...payload, horario_inicio: "08:00:00" });
  assert.equal(seconds.horario_inicio, "08:00");
});

test("endpoint real: 400 antes das dependências e 201 com RPC mockado após corrigir término", async () => {
  Object.assign(process.env, {
    APP_ORIGIN: "https://frontend.example", SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "server-only-test-key", SUPABASE_PUBLISHABLE_KEY: "public-test-key",
    RATE_LIMIT_SECRET: "r".repeat(40),
  });
  const originalFetch = globalThis.fetch;
  let calls = 0, route;
  globalThis.fetch = async (address, options) => {
    calls++;
    const path = new URL(address).pathname;
    if (path.endsWith("/rpc/consume_quota")) return Response.json(true);
    assert.ok(path.endsWith("/rpc/create_manual_itinerary"), `Unexpected call: ${path}`);
    route = JSON.parse(options.body).p_route;
    return Response.json({ encontro: { id: "meeting-7" }, roteiro: { id: "route-7", encontro_id: "meeting-7" } });
  };
  const invoke = async (body) => {
    const res = { setHeader() {}, status(n) { this.code = n; return this; }, json(data) { this.data = data; } };
    await handler({ method: "POST", headers: { origin: process.env.APP_ORIGIN, "content-type": "application/json" },
      socket: { remoteAddress: "127.0.0.1" }, body }, res);
    return res;
  };
  try {
    const payload = buildManualItineraryPayload(itinerary);
    const rejected = await invoke({ ...payload, horario_fim: "16:30" });
    assert.equal(rejected.code, 400);
    assert.equal(rejected.data.issues[0].path, "etapas.6.horario");
    assert.match(rejected.data.issues[0].message, /etapa 7.*16:30.*antes do término/);
    assert.equal(calls, 0);
    assert.equal((await invoke(payload)).code, 201);
    assert.equal(calls, 4);
    assert.equal(route.dados_json.fim, "17:00");
    assert.deepEqual(route.dados_json.etapas.map((stage) => stage.horario), itinerary.etapas.map((stage) => stage.horario));
    assert.deepEqual(route.dados_json.etapas.map((stage) => stage.nome), itinerary.etapas.map((stage) => stage.nome));
  } finally { globalThis.fetch = originalFetch; }
});
