import { api } from "./api.js";
import {
  $,
  escapeHTML as e,
  emptyState,
  loadSection,
  formatDate,
  safeImage,
  todayKey,
} from "./ui.js";
import { initGallery } from "./gallery.js";
import { initCalendar } from "./calendar.js";
import { initItinerary } from "./itinerary.js";
import { initAnimations } from "./animations.js";
const menu = $(".menu-toggle");
menu.addEventListener("click", () => {
  const open = menu.getAttribute("aria-expanded") !== "true";
  menu.setAttribute("aria-expanded", String(open));
  menu.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
  $("#navigation").classList.toggle("open", open);
});
$("#navigation")
  .querySelectorAll("a")
  .forEach((link) =>
    link.addEventListener("click", () => {
      $("#navigation").classList.remove("open");
      menu.setAttribute("aria-expanded", "false");
      menu.setAttribute("aria-label", "Abrir menu");
    }),
  );
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    $("#navigation").classList.remove("open");
    menu.setAttribute("aria-expanded", "false");
  }
});
$('#planner-form [name="data"]').min = todayKey();
const itineraries = initItinerary();
await Promise.allSettled([
  initGallery(),
  initCalendar((id) => itineraries.showForEvent(id)),
  loadSection(
    $("#memory-list"),
    () => api("memorias"),
    (rows) => {
      rows.sort((a, b) => a.data_memoria.localeCompare(b.data_memoria));
      $("#memory-list").innerHTML = rows.length
        ? rows
            .map(
              (row) =>
                `<article class="memory">${safeImage(row.imagem_url) ? `<img src="${e(row.imagem_url)}" alt="${e(row.titulo)}" width="150" height="150" loading="lazy">` : ""}<div><time datetime="${e(row.data_memoria)}">${e(formatDate(row.data_memoria))}</time><h3>${e(row.titulo)}${row.destaque ? " ♡" : ""}</h3><p>${e(row.descricao)}</p><small>${e(row.categoria)}</small></div></article>`,
            )
            .join("")
        : emptyState(
            "Toda história começa com um instante.",
            "As memórias publicadas de Jorge e Antonia terão seu lugar aqui.",
          );
    },
    "Nosso livro ainda está sendo escrito.",
    "As memórias aparecerão aqui assim que o álbum estiver conectado e os primeiros capítulos forem publicados.",
  ),
  api("configuracoes")
    .then((rows) => {
      const c = rows[0];
      if (!c) return;
      $("#hero-message").textContent = c.mensagem_principal;
      const names = `${c.nome_pessoa_1} & ${c.nome_pessoa_2}`;
      $("#couple-names").textContent = names;
      document.title = `${c.nome_site} — ${names}`;
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
    .catch(() => {}),
]);
initAnimations();
