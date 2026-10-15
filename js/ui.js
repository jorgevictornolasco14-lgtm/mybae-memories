export const $ = (selector) => document.querySelector(selector);
export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function formatDate(
  value,
  options = { day: "numeric", month: "long", year: "numeric" },
) {
  return value
    ? new Intl.DateTimeFormat("pt-BR", {
        ...options,
        timeZone: "America/Sao_Paulo",
      }).format(new Date(`${value.slice(0, 10)}T12:00:00-03:00`))
    : "";
}
export function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function emptyState(title, description, retry = false) {
  return `<div class="empty-state"><span class="empty-icon" aria-hidden="true">♡</span><h3>${escapeHTML(title)}</h3><p>${escapeHTML(description)}</p>${retry ? '<button class="text-link retry">Tentar novamente ↗</button>' : ""}</div>`;
}
export async function loadSection(
  target,
  fetcher,
  render,
  emptyTitle,
  emptyDescription,
) {
  const run = async () => {
    try {
      const data = await fetcher();
      render(data);
    } catch (error) {
      target.innerHTML = emptyState(
        emptyTitle,
        error.status === 503 ? emptyDescription : error.message,
        true,
      );
      target.querySelector(".retry").addEventListener("click", run);
    }
  };
  await run();
}
export function mapsURL(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
export function safeImage(url) {
  return typeof url === "string" &&
    (/^\/assets\//.test(url) || /^https:\/\/[^/]+\.supabase\.co\//.test(url))
    ? url
    : "";
}
