import { applyBranding } from "../components/branding.js";
import { initPlanner } from "./ai-planner.js";
import { initItineraryExport } from "./itinerary-export.js";
import { validateItinerary } from "../utils/validators.js";
import { api } from "../api.js";
import { $, emptyState, escapeHTML as e, formatDate, mapsURL, safeImage } from "../components/ui.js";
import { bindMaps } from "./maps.js";
export function initItinerary() {
  let current = null,
    isPublished = false,
    mode = "interactive",
    cleanup = () => { };
  let published = [];
  let requestVersion = 0;
  let selectionVersion = 0;
  const output = $("#itinerary-output");
  const savedChoices = $("#saved-itineraries");

  function enableControls(enabled) {
    for (const id of ["view-interactive", "view-poster", "export-png", "export-pdf"])
      $(`#${id}`).disabled = !enabled;
  }

  function renderState(state, message = "") {
    cleanup();
    cleanup = () => { };
    $("#itinerary-notice").textContent = "";
    $("#export-status").textContent = "";
    enableControls(false);
    output.innerHTML = state === "loading"
      ? '<p class="loading" role="status">Carregando nosso último rolê…</p>'
      : emptyState(state === "error" ? "Não foi possível carregar nosso roteiro." : "Nosso primeiro rolê começa aqui.",
        state === "error" ? message : "Crie nosso primeiro roteiro para guardar mais um dia especial.", state === "error");
    if (state === "empty") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "text-link";
      button.textContent = "Criar nosso primeiro roteiro ♡";
      button.addEventListener("click", () => $("#manual-itinerary-open").click());
      output.querySelector(".empty-state").append(button);
    }
    output.querySelector(".retry")?.addEventListener("click", () => loadPublished({ selectLatest: true }));
  }

  function render() {
    cleanup();
    enableControls(true);
    output.setAttribute("aria-busy", "false");
    $("#export-status").textContent = "";
    $("#itinerary-notice").textContent = isPublished
      ? "Roteiro publicado · Confirme locais, valores, funcionamento e deslocamentos antes de sair."
      : "Prévia do roteiro · Confirme locais, valores, funcionamento e deslocamentos antes de sair.";
    const metadata = [
      current.data ? formatDate(current.data) : "Um dia para nós",
      current.cidade,
      current.transporte ? `Transporte: ${current.transporte}` : "",
      `${current.inicio}–${current.fim}`,
    ].join(" · ");
    $("#itinerary-output").innerHTML =
      `<article class="itinerary-paper ${mode === "poster" ? "poster-mode" : ""}"><header class="itinerary-title"><p class="eyebrow"><span data-site-name>MY BAE</span> · <span data-couple-names>JORGE & MARIA</span></p><h3>${e(current.titulo)}</h3><p>${e(metadata)}</p><p class="script">${e(current.descricao)}</p></header><div class="itinerary-steps">${current.etapas.map((step, i) => `<section class="itinerary-step"><span class="step-number">${i + 1}</span>${safeImage(step.imagem_url) ? `<img class="step-image" src="${e(safeImage(step.imagem_url))}" alt="${e(step.nome)}" loading="lazy" width="160" height="210">` : '<div class="step-placeholder" role="img" aria-label="Ilustração decorativa, sem fotografia do local"><span>✧</span><small>Um novo lugar</small></div>'}<div class="step-content"><time class="time-tag">${e(step.horario)}</time><h4>${e(step.nome)}</h4><p>${e(step.descricao)}</p><a href="${e(mapsURL(step.busca))}" target="_blank" rel="noopener noreferrer">Pesquisar no Google Maps ↗</a><div class="location-controls" data-index="${i}"><label>Local ou endereço a verificar<input value="${e(step.busca)}" minlength="4" maxlength="300" required aria-label="Busca de localização: ${e(step.nome)}"></label><button type="button">Localizar no mapa ↗</button><p class="location-message" role="status"></p></div></div></section>`).join("")}</div><div class="map-section"><div class="map-empty">⌖ Localize e confirme as paradas para construir o mapa.<br>Os locais precisam ser confirmados antes de aparecerem no mapa.</div><div class="route-map" hidden aria-label="Mapa dos locais selecionados"></div><p class="map-note">Marcadores indicam locais selecionados. Percursos e tempos de deslocamento não calculados. Dados © OpenStreetMap.</p></div><div class="itinerary-extras"><div><h4>Se a chuva aparecer</h4><p>${e(current.chuva)}</p></div><div><h4>Uma pausa para comer</h4><p>${e(current.alimentacao)}</p></div><div><h4>Sobre os custos</h4><p>${e(current.custos)}</p></div><div><h4>Antes de sair</h4><ul>${current.recomendacoes.map((r) => `<li>${e(r)}</li>`).join("")}</ul></div></div><p class="poster-footer">${isPublished ? "Roteiro publicado · " : "Prévia do roteiro · "}Mais um dia bonito para viver com você. ♡</p></article>`;
    for (const image of output.querySelectorAll(".step-image")) {
      const showPlaceholder = () => {
        const placeholder = document.createElement("div");
        placeholder.className = "step-placeholder";
        placeholder.setAttribute("role", "img");
        placeholder.setAttribute("aria-label", "Ilustração decorativa, sem fotografia do local");
        placeholder.innerHTML = "<span>✧</span><small>Um novo lugar</small>";
        image.replaceWith(placeholder);
      };
      image.addEventListener("error", showPlaceholder, { once: true });
      if (image.complete && image.naturalWidth === 0) showPlaceholder();
    }
    applyBranding();
    cleanup = bindMaps($("#itinerary-output"), current);
  }
  function setItinerary(data, persisted = false) {
    current = validateItinerary(data);
    selectionVersion++;
    isPublished = persisted;
    render();
  }

  function renderChoices(error = "") {
    savedChoices.replaceChildren();
    if (published.length) {
      const choices = document.createElement("div");
      choices.className = "saved-choices";
      choices.setAttribute("aria-label", "Roteiros publicados");
      published.forEach((row) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = row.titulo;
        button.addEventListener("click", () => setItinerary(row.dados_json, true));
        choices.append(button);
      });
      savedChoices.append(choices);
    }
    if (error && current) {
      const message = document.createElement("p");
      message.className = "notice";
      message.setAttribute("role", "status");
      message.textContent = `Não foi possível atualizar a lista de roteiros. ${error}`;
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "text-link retry";
      retry.textContent = "Tentar novamente ↗";
      retry.addEventListener("click", () => loadPublished());
      savedChoices.append(message, retry);
    }
  }

  async function loadPublished({ selectLatest = false } = {}) {
    const version = ++requestVersion;
    const selectionAtStart = selectionVersion;
    savedChoices.setAttribute("aria-busy", "true");
    if (!current) {
      renderState("loading");
      output.setAttribute("aria-busy", "true");
    }
    try {
      // GET /api/roteiros returns published rows in created_at DESC order.
      // Keep that order, independently of event dates and updated_at.
      const rows = await api("roteiros", { cache: "no-store" });
      if (version !== requestVersion) return null;
      published = rows;
      renderChoices();
      if (selectLatest && selectionAtStart === selectionVersion) {
        if (rows.length) setItinerary(rows[0].dados_json, true);
        else renderState("empty");
      }
      return rows;
    } catch (error) {
      if (version !== requestVersion) return null;
      renderChoices(error.message);
      if (!current) renderState("error", error.message);
      return null;
    } finally {
      if (version === requestVersion) {
        savedChoices.setAttribute("aria-busy", "false");
        output.setAttribute("aria-busy", "false");
      }
    }
  }

  function view(next) {
    if (!current) return;
    mode = next;
    for (const [id, value] of [
      ["view-interactive", "interactive"],
      ["view-poster", "poster"],
    ]) {
      $(`#${id}`).classList.toggle("active", mode === value);
      $(`#${id}`).setAttribute("aria-pressed", String(mode === value));
    }
    // Toggle the presentation without discarding selected map locations.
    $("#itinerary-output .itinerary-paper").classList.toggle(
      "poster-mode",
      mode === "poster",
    );
    if (mode === "interactive") window.dispatchEvent(new Event("resize"));
  }
  $("#view-interactive").addEventListener("click", () => view("interactive"));
  $("#view-poster").addEventListener("click", () => view("poster"));
  initPlanner(setItinerary);
  initItineraryExport();
  const ready = loadPublished({ selectLatest: true });
  window.addEventListener("mybae:meeting-created", async (event) => {
    const row = event.detail?.roteiro;
    if (!row) return;
    // A validated HTTP 201 confirms this row. Older reads cannot replace it.
    requestVersion++;
    published = [row, ...published.filter((item) => item.id !== row.id)];
    setItinerary(row.dados_json, true);
    renderChoices();
    output.setAttribute("aria-busy", "false");
    // api() deduplicates identical requests; let startup finish before re-reading.
    await ready;
    await loadPublished();
  });
  return {
    setItinerary,
    async showForEvent(id) {
      await ready;
      const rows = await loadPublished();
      if (!rows) throw new Error("Não foi possível atualizar os roteiros. Tente novamente.");
      const row = rows.find((r) => String(r.encontro_id) === String(id));
      if (!row)
        throw new Error("Ainda não há roteiro publicado para este encontro.");
      setItinerary(row.dados_json, true);
      $("#roteiros").scrollIntoView({ behavior: "smooth" });
    },
  };
}
