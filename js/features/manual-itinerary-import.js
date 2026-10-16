import { isDate } from "../utils/validators.js";

const MAX_BYTES = 256 * 1024;
const MAX_STEPS = 30;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const SINGLE_FIELDS = new Set([
  "manual_titulo", "manual_data", "manual_cidade", "manual_inicio",
  "manual_transporte", "manual_descricao",
]);
const STEP_FIELDS = ["manual_horario", "manual_nome", "manual_etapa_descricao", "manual_endereco"];
const OPTIONAL_SINGLE_FIELDS = new Set(["manual_fim"]);
const ALLOWED_FIELDS = new Set([...SINGLE_FIELDS, ...OPTIONAL_SINGLE_FIELDS, ...STEP_FIELDS, "manual_fotografia"]);
const LIMITS = {
  manual_titulo: 100, manual_data: 10, manual_cidade: 100, manual_inicio: 5, manual_fim: 5,
  manual_transporte: 60, manual_descricao: 1000, manual_horario: 5, manual_nome: 120,
  manual_etapa_descricao: 500, manual_endereco: 300,
};
const text = (value, name, { required = true, min = 0, max = LIMITS[name] ?? 0 } = {}) => {
  if (typeof value !== "string" || value.length > max || (required && value.trim().length < min)) {
    throw new Error(`O campo ${name} está ausente ou inválido no arquivo.`);
  }
  return value;
};

export function parseManualItineraryImport(source) {
  if (typeof source !== "string" || new TextEncoder().encode(source).length > MAX_BYTES) {
    throw new Error("O arquivo JSON excede o limite de 256 KB.");
  }
  let parsed;
  try { parsed = JSON.parse(source); }
  catch { throw new Error("O arquivo selecionado não contém um JSON válido."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
      typeof parsed.salvoEm !== "string" || !Number.isFinite(Date.parse(parsed.salvoEm)) ||
      !Array.isArray(parsed.campos) || !parsed.campos.length || parsed.campos.length > 200) {
    throw new Error("O arquivo não corresponde ao formato de roteiro My Bae (salvoEm e campos).");
  }
  const values = new Map();
  for (const field of parsed.campos) {
    if (!field || typeof field !== "object" || Array.isArray(field) ||
        typeof field.name !== "string" || typeof field.value !== "string") {
      throw new Error("O arquivo possui um campo malformado.");
    }
    if (!ALLOWED_FIELDS.has(field.name)) continue;
    if (SINGLE_FIELDS.has(field.name) || OPTIONAL_SINGLE_FIELDS.has(field.name)) {
      if (values.has(field.name)) throw new Error(`O campo ${field.name} aparece mais de uma vez.`);
      values.set(field.name, field.value);
    } else {
      if (!values.has(field.name)) values.set(field.name, []);
      values.get(field.name).push(field.value);
    }
  }
  const result = {};
  for (const name of SINGLE_FIELDS) {
    if (!values.has(name)) throw new Error(`O arquivo está incompleto: falta ${name}.`);
    result[name] = text(values.get(name), name, { min: name === "manual_descricao" ? 0 : 2 });
  }
  if (!isDate(result.manual_data) || !TIME.test(result.manual_inicio)) {
    throw new Error("A data ou o hor\u00e1rio de in\u00edcio do roteiro s\u00e3o inv\u00e1lidos.");
  }
  const count = values.get("manual_nome")?.length ?? 0;
  if (count < 1 || count > MAX_STEPS || STEP_FIELDS.some((name) => values.get(name)?.length !== count)) {
    throw new Error(`O roteiro deve conter de 1 a ${MAX_STEPS} etapas completas e na ordem original.`);
  }
  result.steps = Array.from({ length: count }, (_, index) => {
    const step = Object.fromEntries(STEP_FIELDS.map((name) => [name, text(values.get(name)[index], name, {
      min: name === "manual_endereco" ? 4 : name === "manual_etapa_descricao" ? 0 : 2,
    })]));
    if (!TIME.test(step.manual_horario) || step.manual_horario < result.manual_inicio ||
        (index > 0 && step.manual_horario < values.get("manual_horario")[index - 1])) {
      throw new Error(`O horário da etapa ${index + 1} está inválido ou fora de ordem.`);
    }
    return step;
  });
  const importedEnd = typeof values.get("manual_fim") === "string" ? values.get("manual_fim").trim() : "";
  result.manual_fim = importedEnd || result.steps.at(-1).manual_horario;
  result.endTimeEstimated = !importedEnd;
  if (!TIME.test(result.manual_fim) || result.manual_fim <= result.manual_inicio ||
      result.steps.at(-1).manual_horario > result.manual_fim) {
    throw new Error("O hor\u00e1rio final est\u00e1 ausente ou inv\u00e1lido. Preencha-o no formul\u00e1rio para continuar.");
  }
  result.photoFilesNeedReselection = (values.get("manual_fotografia") || []).some((value) => value.trim());
  return result;
}
