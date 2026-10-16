import { CONFIG, ENDPOINTS } from "./config.js";
import { validateResponse } from "./utils/validators.js";
const pending = new Map();
export function api(name, { method = ENDPOINTS[name]?.method, body, cache = "default" } = {}) {
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
  const key = JSON.stringify([url, method, body, cache]);
  if (pending.has(key)) return pending.get(key);
  const request = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method, mode: "cors", credentials: "omit",
        cache,
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
      if (error instanceof TypeError) throw new Error("Não foi possível conectar ao serviço. Confira sua conexão; se persistir, a origem do site precisa ser autorizada no backend (CORS).");
      throw error;
    } finally { clearTimeout(timeout); }
  })();
  pending.set(key, request);
  const cleanup = () => pending.delete(key);
  request.then(cleanup, cleanup);
  return request;
}

// Multipart bodies must keep the browser-generated Content-Type boundary.
export async function uploadGalleryPhoto(formData) {
  const endpoint = ENDPOINTS.galeriaUpload;
  if (!CONFIG.API_BASE_URL.trim()) throw new Error("Nosso álbum ainda não está conectado. Tente novamente em breve.");
  let url;
  try {
    const base = new URL(CONFIG.API_BASE_URL);
    url = `${base.href.replace(/\/$/, "")}${endpoint.path}`;
  } catch { throw new Error("O endereço do serviço está inválido."); }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: endpoint.method, mode: "cors", credentials: "omit",
      headers: { Accept: "application/json" }, body: formData, signal: controller.signal,
    });
    if (!response.ok) {
      throw Object.assign(new Error(response.status === 413
        ? "A fotografia excede o limite permitido pelo servidor."
        : response.status === 429
          ? "Muitas tentativas. Aguarde um pouco e tente novamente."
          : response.status === 503
            ? "O serviço está temporariamente indisponível. Tente novamente em breve."
            : "Não foi possível publicar a fotografia. Confira os dados e tente novamente."), { status: response.status });
    }
  } catch (error) {
    if (controller.signal.aborted) throw new Error("O envio demorou para responder. Verifique sua conexão antes de tentar novamente.");
    if (error instanceof TypeError) throw new Error("Não foi possível conectar ao serviço. Confira sua conexão ou a autorização CORS do site.");
    throw error;
  } finally { clearTimeout(timeout); }
}
