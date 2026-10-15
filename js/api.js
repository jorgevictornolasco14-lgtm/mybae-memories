export async function api(path, { method = "GET", body, csrf } = {}) {
  const response = await fetch(`/api/${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(55000),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Não foi possível acessar o serviço. Tente novamente.");
  }
  if (!response.ok) {
    const error = new Error(data.error || "Não foi possível concluir.");
    error.status = response.status;
    throw error;
  }
  return data;
}
