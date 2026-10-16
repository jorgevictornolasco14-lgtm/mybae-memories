export function isDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) => typeof value === "string" && value.trim().length > 0;
const time = (value) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);
export function validateItinerary(value) {
  if (!object(value) || !text(value.titulo) || !text(value.cidade) ||
    !time(value.inicio) || !time(value.fim) ||
    (value.data != null && !isDate(value.data)) ||
    !Array.isArray(value.etapas) || !value.etapas.length || value.etapas.length > 30 ||
    !value.etapas.every((step) => object(step) && text(step.nome) && time(step.horario) &&
      text(step.descricao) && text(step.busca)) ||
    (value.recomendacoes != null && (!Array.isArray(value.recomendacoes) ||
      !value.recomendacoes.every((item) => typeof item === "string")))) {
    throw new Error("O serviço enviou um roteiro inválido. Tente gerar novamente.");
  }
  const result = { ...value, recomendacoes: value.recomendacoes ?? [] };
  for (const key of ["descricao", "chuva", "alimentacao", "custos"]) {
    if (result[key] != null && typeof result[key] !== "string") throw new Error("O serviço enviou um roteiro inválido.");
    result[key] ??= "";
  }
  return result;
}
export function validateResponse(path, data) {
  if (path === "ai") return validateItinerary(data);
  if (path === "memoriaCreate") return data;
  if (path === "manualItineraryCreate") {
    if (!object(data) || data.success !== true || !object(data.encontro) ||
      data.encontro.id == null || !text(data.encontro.titulo) || !isDate(data.encontro.data_encontro) ||
      !object(data.roteiro) || data.roteiro.encontro_id !== data.encontro.id ||
      !object(data.roteiro.dados_json))
      throw new Error("O serviço não confirmou o cadastro do encontro.");
    validateItinerary(data.roteiro.dados_json);
    return data;
  }
  if (["photoDelete", "memoryDelete"].includes(path)) {
    if (!object(data) || data.success !== true || typeof data.deleted !== "boolean")
      throw new Error("O serviÃ§o nÃ£o confirmou a exclusÃ£o.");
    return data;
  }
  if (!Array.isArray(data) || !data.every(object)) throw new Error("O serviço enviou dados em um formato inesperado.");
  const valid = data.every((row) => {
    if (path === "memorias") return text(row.titulo) && isDate(row.data_memoria);
    if (path === "galeria") return text(row.imagem_url || row.url) && (!row.data_foto || isDate(row.data_foto));
    if (path === "encontros") return row.id != null && text(row.titulo) && isDate(row.data_encontro) && time(row.horario_inicio);
    if (path === "roteiros") { validateItinerary(row.dados_json); return text(row.titulo); }
    if (path === "configuracoes") return ["nome_site", "nome_pessoa_1", "nome_pessoa_2", "mensagem_principal", "imagem_capa"]
      .every((key) => row[key] == null || typeof row[key] === "string") &&
      (!row.data_inicio_relacionamento || isDate(row.data_inicio_relacionamento));
    if (path === "mapas") return text(row.nome) && Number.isFinite(row.latitude) && Math.abs(row.latitude) <= 90 &&
      Number.isFinite(row.longitude) && Math.abs(row.longitude) <= 180;
    return false;
  });
  if (!valid) throw new Error("O serviço enviou dados incompletos ou inválidos.");
  return data;
}
export function validatePreferences(data, today) {
  if (!text(data.cidade) || data.cidade.trim().length < 2 || data.cidade.length > 100 ||
    !isDate(data.data) || data.data < today || !time(data.inicio) ||
    !["2", "4", "6", "8"].includes(data.duracao) ||
    !text(data.orcamento) || !Number.isFinite(Number(data.orcamento)) ||
    Number(data.orcamento) < 0 || Number(data.orcamento) > 100000 ||
    !text(data.tipo) || !text(data.transporte) ||
    (data.preferencias || "").length > 800 || (data.restricoes || "").length > 800) {
    throw new Error("Confira cidade, data, horário, duração e orçamento antes de continuar.");
  }
  return { ...data, cidade: data.cidade.trim() };
}
