// Configuração pública em memória, compartilhada com os roteiros renderizados depois.
const branding = { nome_site: "My Bae", nome_pessoa_1: "Jorge", nome_pessoa_2: "Antonia" };
export function applyBranding(settings = {}) {
  for (const key of Object.keys(branding)) {
    if (typeof settings[key] === "string" && settings[key].trim()) branding[key] = settings[key].trim();
  }
  const names = `${branding.nome_pessoa_1} & ${branding.nome_pessoa_2}`;
  document.querySelectorAll("[data-site-name]").forEach((node) => { node.textContent = branding.nome_site; });
  document.querySelectorAll("[data-couple-names]").forEach((node) => { node.textContent = names; });
  for (const person of [1, 2]) {
    document.querySelectorAll(`[data-person="${person}"]`).forEach((node) => {
      node.textContent = branding[`nome_pessoa_${person}`];
    });
  }
  document.querySelectorAll(".brand").forEach((node) => {
    node.setAttribute("aria-label", `${branding.nome_site}, início`);
  });
  document.title = `${branding.nome_site} — ${names}`;
  document.querySelector('meta[property="og:title"]').content = document.title;
  if (typeof settings.mensagem_principal === "string" && settings.mensagem_principal.trim()) {
    document.querySelector("#hero-message").textContent = settings.mensagem_principal;
    document.querySelector('meta[name="description"]').content = settings.mensagem_principal;
    document.querySelector('meta[property="og:description"]').content = settings.mensagem_principal;
  }
  return names;
}
