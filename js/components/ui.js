export const $ = (selector) => document.querySelector(selector);
export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
      c
      ],
  );
export { formatDate, todayKey } from "../utils/dates.js";
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
    target.setAttribute("aria-busy", "true");
    target.innerHTML = '<p class="loading">Carregando…</p>';
    let loaded = true;
    try {
      const data = await fetcher();
      render(data);
    } catch (error) {
      loaded = false;
      target.innerHTML = emptyState(
        emptyTitle,
        error.status === 503 ? emptyDescription : error.message,
        true,
      );
      target.querySelector(".retry").addEventListener("click", run);
    } finally { target.setAttribute("aria-busy", "false"); }
    return loaded;
  };
  return run();
}
export function mapsURL(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
export function safeImage(value) {
  if (typeof value !== "string" || !value) return "";
  try {
    const url = new URL(value, window.location.origin);
    if (url.username || url.password || url.hash) return "";
    if (url.origin === window.location.origin && url.pathname.startsWith("/assets/images/") && !url.search) return url.href;
    if (url.protocol === "https:" && /^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)) {
      if (url.pathname.startsWith("/storage/v1/object/public/") && !url.search) return url.href;
      if (url.pathname.startsWith("/storage/v1/object/sign/") && url.searchParams.has("token")) return url.href;
    }
  } catch { }
  return "";
}
