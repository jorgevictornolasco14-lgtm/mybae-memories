import { api } from "../api.js";
import {
  $,
  emptyState,
  todayKey,
  formatDate,
  mapsURL,
  escapeHTML as e,
} from "../components/ui.js";

export function initCalendar(onItinerary) {
  const current = todayKey();
  let [year, month] = current.split("-").map(Number);
  month--;
  let events = [];
  let selected = null;
  let loadError = "";
  let requestId = 0;
  const dialog = $("#event-details-dialog");

  function sorted(rows) {
    return [...rows].sort((a, b) =>
      `${a.data_encontro}${a.horario_inicio}`.localeCompare(`${b.data_encontro}${b.horario_inicio}`),
    );
  }

  function renderEventDialog(day, rows) {
    $("#event-dialog-title").textContent = formatDate(day, { day: "numeric", month: "long" });
    const list = $("#event-dialog-list");
    list.replaceChildren(...rows.map((row) => {
      const item = document.createElement("article");
      item.className = "event-dialog-item";
      const time = document.createElement("time");
      time.dateTime = `${row.data_encontro}T${row.horario_inicio}`;
      time.textContent = `${formatDate(row.data_encontro)} · ${row.horario_inicio.slice(0, 5)}`;
      const title = document.createElement("h3");
      title.textContent = row.titulo;
      const routeButton = document.createElement("button");
      routeButton.className = "text-link event-dialog-route";
      routeButton.type = "button";
      routeButton.dataset.event = row.id;
      routeButton.textContent = "Ver cronograma completo ↗";
      item.append(time, title, routeButton);
      for (const value of [row.local, row.endereco, row.cidade, row.descricao]) {
        if (!value) continue;
        const detail = document.createElement("p");
        detail.textContent = value;
        item.append(detail);
      }
      return item;
    }));
    list.querySelectorAll(".event-dialog-route").forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        try { await onItinerary(button.dataset.event); }
        catch (error) { button.textContent = error.message; }
        finally { button.disabled = false; }
      });
    });
    if (!dialog.open) dialog.showModal();
  }

  function showEvents(day = null, openDetails = false) {
    selected = day;
    $("#selected-day").textContent = day
      ? formatDate(day, { day: "numeric", month: "long" })
      : "Próximos encontros";
    const rows = sorted(events.filter((row) => day
      ? row.data_encontro === day
      : row.data_encontro >= current && row.status !== "Cancelado"));
    const list = $("#event-list");
    if (loadError) {
      list.innerHTML = emptyState("Não foi possível atualizar os encontros.", loadError, true);
    } else if (rows.length) {
      list.innerHTML = rows.map((row) => {
        const place = [row.local, row.cidade].filter(Boolean).join(", ");
        const description = row.descricao
          ? `<p class="event-description">${e(row.descricao.length > 135 ? `${row.descricao.slice(0, 132)}…` : row.descricao)}</p>`
          : "";
        return `<article class="event" data-event-id="${e(row.id)}"><div class="event-date"><span>${Number(row.data_encontro.slice(-2))}</span><small>${e(formatDate(row.data_encontro, { month: "short" }))}</small></div><div class="event-content"><h4>${e(row.titulo)}</h4><p>${e(row.horario_inicio.slice(0, 5))}${place ? ` · ${e(place)}` : ""}</p>${description}<span class="badge">${e(row.status || "Confirmado")}</span><details><summary>Detalhes do encontro</summary>${row.endereco ? `<p>${e(row.endereco)}</p>` : ""}${row.descricao ? `<p>${e(row.descricao)}</p>` : ""}${row.orcamento != null ? `<p>Orçamento: ${e(new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(row.orcamento))}</p>` : ""}<a class="text-link" href="${e(mapsURL([row.endereco || row.local, row.cidade].filter(Boolean).join(", ")))}" target="_blank" rel="noopener noreferrer">Pesquisar no mapa ↗</a>${row.preferencias ? `<p>${e(row.preferencias)}</p>` : ""}<button class="text-link event-route" data-event="${e(row.id)}" type="button">Ver roteiro associado ↗</button></details></div></article>`;
      }).join("");
    } else {
      list.innerHTML = emptyState(
        day ? "Um dia cheio de possibilidades." : "Vamos marcar algo especial?",
        day ? "Nenhum encontro publicado nesta data." : "Os próximos encontros publicados aparecerão aqui.",
      );
    }
    list.querySelectorAll(".event-route").forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        try { await onItinerary(button.dataset.event); }
        catch (error) { button.textContent = error.message; }
        finally { button.disabled = false; }
      });
    });
    list.querySelector(".retry")?.addEventListener("click", () => load());
    draw();
    if (openDetails && day && rows.length && !loadError) renderEventDialog(day, rows);
    if (day) $("#calendar-days").querySelector(`[data-date="${day}"]`)?.focus({ preventScroll: true });
  }

  function draw() {
    $("#calendar-month").textContent = new Intl.DateTimeFormat("pt-BR", {
      month: "long", year: "numeric", timeZone: "America/Sao_Paulo",
    }).format(new Date(Date.UTC(year, month, 15, 15)));
    const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const days = $("#calendar-days");
    days.innerHTML = "<span></span>".repeat(first) + Array.from({ length: count }, (_, i) => {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
      const dayEvents = events.filter((row) => row.data_encontro === key);
      return `<button class="${key === current ? "today " : ""}${selected === key ? "selected " : ""}${dayEvents.length ? "has-event" : ""}" data-date="${key}" aria-label="${e(formatDate(key))}${dayEvents.length ? `, ${dayEvents.length} encontro(s)` : ""}" ${key === current ? 'aria-current="date"' : ""} aria-pressed="${selected === key}">${i + 1}</button>`;
    }).join("");
    days.setAttribute("aria-busy", "false");
    days.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => showEvents(button.dataset.date, true));
    });
  }

  async function load() {
    const thisRequest = ++requestId;
    loadError = "";
    $("#event-list").setAttribute("aria-busy", "true");
    $("#calendar-days").setAttribute("aria-busy", "true");
    $("#calendar-status").classList.remove("error");
    $("#calendar-status").textContent = "Atualizando encontros…";
    try {
      const response = await api("encontros", { cache: "no-store" });
      if (thisRequest !== requestId) return false;
      events = response;
    } catch (error) {
      if (thisRequest !== requestId) return false;
      loadError = error.message || "Não foi possível carregar os encontros.";
      $("#calendar-status").classList.add("error");
      $("#calendar-status").textContent = "Não foi possível atualizar a agenda. Use ‘Ver próximos encontros’ para tentar novamente.";
    } finally {
      if (thisRequest === requestId) {
        $("#event-list").setAttribute("aria-busy", "false");
        $("#calendar-days").setAttribute("aria-busy", "false");
        if (!loadError) $("#calendar-status").textContent = "";
        showEvents(selected);
      }
    }
    return !loadError;
  }

  function move(delta) {
    month += delta;
    if (month < 0) { month = 11; year--; }
    if (month > 11) { month = 0; year++; }
    selected = null;
    showEvents();
    load();
  }

  window.addEventListener("mybae:meeting-created", (event) => {
    const date = event.detail?.date;
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    [year, month] = date.split("-").map(Number);
    month -= 1;
    selected = date;
    load();
  });

  $("#prev-month").addEventListener("click", () => move(-1));
  $("#next-month").addEventListener("click", () => move(1));
  $("#show-upcoming").addEventListener("click", () => {
    selected = null;
    if (dialog.open) dialog.close();
    showEvents();
    load();
  });
  $("#event-dialog-close").addEventListener("click", () => dialog.close());
  draw();
  return load();
}
