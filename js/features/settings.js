import { api } from "../api.js";
import { applyBranding } from "../components/branding.js";
import { $, safeImage, todayKey } from "../components/ui.js";

export function initSettings() {
  const target = $("#site-config"), status = $("#config-status");
  async function load() {
    target.setAttribute("aria-busy", "true");
    status.replaceChildren(document.createTextNode("Carregando nosso universo…"));
    try {
      // A API retorna um array diretamente; a configuração é seu primeiro registro.
      const rows = await api("configuracoes");
      const settings = rows[0];
      if (!settings) {
        status.textContent = "Nosso universo está pronto para receber os primeiros detalhes.";
        return;
      }
      const names = applyBranding(settings);
      const cover = safeImage(settings.imagem_capa);
      if (cover) {
        $(".polaroid-front img").src = cover;
        $(".polaroid-front img").alt = `Fotografia de ${names}`;
        $(".art-caption").textContent = "UM INSTANTE DO NOSSO UNIVERSO";
      }
      $("#together").hidden = true;
      if (settings.data_inicio_relacionamento) {
        const days = Math.floor((new Date(`${todayKey()}T00:00:00-03:00`) -
          new Date(`${settings.data_inicio_relacionamento}T00:00:00-03:00`)) / 86400000);
        if (days >= 0) {
          $("#together").hidden = false;
          $("#together").textContent = `♡ ${days.toLocaleString("pt-BR")} ${days === 1 ? "dia" : "dias"} colecionando momentos juntos.`;
        }
      }
      status.replaceChildren();
    } catch (error) {
      status.textContent = `Não foi possível carregar os detalhes do nosso universo. ${error.message} `;
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "text-link retry";
      retry.textContent = "Tentar novamente ↗";
      retry.addEventListener("click", load);
      status.append(retry);
    } finally {
      target.setAttribute("aria-busy", "false");
    }
  }
  return load();
}
