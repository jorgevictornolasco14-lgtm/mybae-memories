import { CONFIG, ENDPOINTS } from "./config.js";
import { validateResponse } from "./utils/validators.js";
const pending = new Map();
export function api(name, { method = ENDPOINTS[name]?.method, body } = {}) {
  const endpoint = ENDPOINTS[name];
  if (!endpoint || method !== endpoint.method) return Promise.reject(new Error("Operação indisponível."));
  if (!CONFIG.API_BASE_URL.trim()) return Promise.reject(Object.assign(new Error("Nosso álbum ainda não está conectado. Tente novamente em breve."), { status: 503 }));
  let url;
  try {
    const base = new URL(CONFIG.API_BASE_URL);
    if (base.username || base.password || base.search || base.hash ||
      (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname)))) throw new Error();
    url = `${base.href.replace(/\/$/, "")}${endpoint.path}`;
  } catch { return Promise.reject(new Error("O endereço do serviço está inválido. Verifique a configuração do site.")); }
  const key = JSON.stringify([url, method, body]);
  if (pending.has(key)) return pending.get(key);
  const request = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method, credentials: "omit",
        headers: { Accept: "application/json", ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: controller.signal,
      });
      if (!response.ok) {
        const message = response.status === 429 ? "Muitas solicitações. Aguarde um pouco e tente novamente." :
          response.status === 503 ? "O serviço está temporariamente indisponível. Tente novamente em breve." :
            "Não foi possível concluir a solicitação. Tente novamente.";
        throw Object.assign(new Error(message), { status: response.status });
      }
      let data;
      try { data = await response.json(); }
      catch { throw new Error("O serviço enviou uma resposta inválida. Tente novamente."); }
      return validateResponse(name, data);
    } catch (error) {
      if (controller.signal.aborted) throw new Error("O serviço demorou para responder. Tente novamente.");
      if (error instanceof TypeError) throw new Error("Não foi possível conectar ao serviço. Confira sua conexão e tente novamente.");
      throw error;
    } finally { clearTimeout(timeout); }
  })();
  pending.set(key, request);
  const cleanup = () => pending.delete(key);
  request.then(cleanup, cleanup);
  return request;
}
