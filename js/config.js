// Endereço público do backend, sem /api no final. Vazio desativa as chamadas.
export const CONFIG = { API_BASE_URL: "", REQUEST_TIMEOUT_MS: 55000 };
// Rotas observadas no frontend original; confirmar com o backend privado.
export const ENDPOINTS = Object.fromEntries(
  ["memorias", "galeria", "encontros", "configuracoes", "roteiros", "ai", "mapas"].map(
    (name) => [name, { path: `/api/${name}`, method: ["ai", "mapas"].includes(name) ? "POST" : "GET" }],
  ),
);
