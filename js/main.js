import { initMemories } from "./features/memories.js";
import { initNavbar } from "./components/navbar.js";
import { api } from "./api.js";
import { $, safeImage, todayKey } from "./components/ui.js";
import { initGallery } from "./features/gallery.js";
import { initCalendar } from "./features/calendar.js";
import { initItinerary } from "./features/itinerary.js";
import { initAnimations } from "./components/animations.js";
initNavbar();
$('#planner-form [name="data"]').min = todayKey();
const itineraries = initItinerary();
await Promise.allSettled([
  initGallery(),
  initCalendar((id) => itineraries.showForEvent(id)),
  initMemories(),
  api("configuracoes")
    .then((rows) => {
      const c = rows[0];
      if (!c) return;
      if (c.mensagem_principal) $("#hero-message").textContent = c.mensagem_principal;
      const names = `${c.nome_pessoa_1 || "Jorge"} & ${c.nome_pessoa_2 || "Antonia"}`;
      $("#couple-names").textContent = names;
      document.title = `My Bae — ${names}`;
      if (safeImage(c.imagem_capa)) {
        $(".polaroid-front img").src = c.imagem_capa;
        $(".polaroid-front img").alt = `Fotografia de ${names}`;
        $(".art-caption").textContent = "UM INSTANTE DO NOSSO UNIVERSO";
      }
      if (c.data_inicio_relacionamento) {
        const start = new Date(
          c.data_inicio_relacionamento + "T00:00:00-03:00",
        ),
          days = Math.floor(
            (new Date(todayKey() + "T00:00:00-03:00") - start) / 86400000,
          );
        if (days >= 0) {
          $("#together").hidden = false;
          $("#together").textContent =
            `♡ ${days.toLocaleString("pt-BR")} ${days === 1 ? "dia" : "dias"} colecionando momentos juntos.`;
        }
      }
    })
    .catch(() => { }),
]);
initAnimations();
