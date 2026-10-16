import { api } from "../api.js";
import {
  $,
  escapeHTML as e,
  emptyState,
  todayKey,
  formatDate,
  mapsURL,
} from "../components/ui.js";
export function initCalendar(onItinerary) {
  const current = todayKey();
  let [year, month] = current.split("-").map(Number);
  month--;
  let events = [],
    selected = null,
    loadError = "";
  function showEvents(day = null) {
    selected = day;
    $("#selected-day").textContent = day
      ? formatDate(day, { day: "numeric", month: "long" })
      : "Próximos encontros";
    const rows = events
      .filter((row) =>
        day
          ? row.data_encontro === day
          : row.data_encontro >= current && row.status !== "Cancelado",
      )
      .sort((a, b) =>
        `${a.data_encontro}${a.horario_inicio}`.localeCompare(
          `${b.data_encontro}${b.horario_inicio}`,
        ),
      );
    $("#event-list").innerHTML = loadError
      ? emptyState("Tempo para o nosso próximo capítulo.", loadError, true)
      : rows.length
        ? rows
            .map(
              (row) =>
                `<article class="event"><div class="event-date">${Number(row.data_encontro.slice(-2))}<small>${e(formatDate(row.data_encontro, { month: "short" }))}</small></div><div><h4>${e(row.titulo)}</h4><p>${e(row.horario_inicio.slice(0, 5))} · ${e(row.local || row.cidade)}</p><span class="badge">${e(row.status)}</span><details><summary>Detalhes do encontro</summary><p>${e(row.descricao)}</p><p>${e(row.endereco)}</p>${row.orcamento != null ? `<p>Orçamento: ${e(new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(row.orcamento))}</p>` : ""}<a class="text-link" href="${e(mapsURL([row.endereco || row.local, row.cidade].join(", ")))}" target="_blank" rel="noopener noreferrer">Pesquisar no mapa ↗</a><p>${e(row.preferencias)}</p><button class="text-link event-route" data-event="${e(row.id)}">Ver roteiro associado ↗</button></details></div></article>`,
            )
            .join("")
        : emptyState(
            day
              ? "Um dia cheio de possibilidades."
              : "Vamos marcar algo especial?",
            day
              ? "Nenhum encontro publicado nesta data."
              : "Os próximos encontros publicados aparecerão aqui.",
          );
    $("#event-list")
      .querySelectorAll(".event-route")
      .forEach((button) =>
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            await onItinerary(button.dataset.event);
          } catch (error) {
            button.textContent = error.message;
          } finally {
            button.disabled = false;
          }
        }),
      );
    $("#event-list .retry")?.addEventListener("click", load);
    draw();
    if (day) $("#calendar-days").querySelector(`[data-date="${day}"]`)?.focus({ preventScroll: true });
  }
  function draw() {
    $("#calendar-month").textContent = new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(Date.UTC(year, month, 15, 15)));
    const first = new Date(Date.UTC(year, month, 1)).getUTCDay(),
      count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    $("#calendar-days").innerHTML =
      "<span></span>".repeat(first) +
      Array.from({ length: count }, (_, i) => {
        const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
          dayEvents = events.filter((r) => r.data_encontro === key);
        return `<button class="${key === current ? "today " : ""}${selected === key ? "selected " : ""}${dayEvents.length ? "has-event" : ""}" data-date="${key}" aria-label="${e(formatDate(key))}${dayEvents.length ? `, ${dayEvents.length} encontro(s)` : ""}" ${key === current ? 'aria-current="date"' : ""} aria-pressed="${selected === key}">${i + 1}</button>`;
      }).join("");
    $("#calendar-days")
      .querySelectorAll("button")
      .forEach((button) =>
        button.addEventListener("click", () => showEvents(button.dataset.date)),
      );
  }
  function move(delta) {
    month += delta;
    if (month < 0) {
      month = 11;
      year--;
    }
    if (month > 11) {
      month = 0;
      year++;
    }
    draw();
  }
  $("#prev-month").addEventListener("click", () => move(-1));
  $("#next-month").addEventListener("click", () => move(1));
  $("#show-upcoming").addEventListener("click", () => showEvents());
  draw();
  async function load() {
    loadError = "";
    $("#event-list").setAttribute("aria-busy", "true");
    $("#event-list").innerHTML = '<p class="loading">Preparando nossa agenda…</p>';
    try { events = await api("encontros"); }
    catch (error) { loadError = error.message; }
    finally {
      $("#event-list").setAttribute("aria-busy", "false");
      showEvents(selected);
    }
  }
  return load();
}
