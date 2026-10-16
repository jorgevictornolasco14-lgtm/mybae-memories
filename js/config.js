// Endereço público do backend, sem /api no final. Vazio desativa as chamadas.
export const CONFIG = { API_BASE_URL: "https://mybae-backend-seven.vercel.app", REQUEST_TIMEOUT_MS: 55000 };
// GETs públicos. O backend observado ainda responde 405 a POST /api/memorias;
// o frontend apresenta esse erro sem fingir que a memória foi salva.
export const ENDPOINTS = Object.fromEntries(
  ["memorias", "galeria", "encontros", "configuracoes", "roteiros", "ai", "mapas"].map(
    (name) => [name, { path: `/api/${name}`, method: ["ai", "mapas"].includes(name) ? "POST" : "GET" }],
  ),
);
ENDPOINTS.galeriaUpload = { path: "/api/galeria", method: "POST" };
ENDPOINTS.memoriaCreate = { path: "/api/memorias", method: "POST" };
ENDPOINTS.manualItineraryCreate = { path: "/api/encontros", method: "POST" };
ENDPOINTS.photoDelete = { path: "/api/galeria", method: "DELETE" };
ENDPOINTS.memoryDelete = { path: "/api/memorias", method: "DELETE" };
