// Endereço público do backend, sem /api no final. Vazio desativa as chamadas.
export const CONFIG = { API_BASE_URL: "https://mybae-backend-seven.vercel.app", REQUEST_TIMEOUT_MS: 55000 };
// GETs de coleções confirmados em produção. Campos de coleções vazias e
// contratos POST continuam pendentes; ver docs/API.md.
export const ENDPOINTS = Object.fromEntries(
  ["memorias", "galeria", "encontros", "configuracoes", "roteiros", "ai", "mapas"].map(
    (name) => [name, { path: `/api/${name}`, method: ["ai", "mapas"].includes(name) ? "POST" : "GET" }],
  ),
);
