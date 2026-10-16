import { initPlanner } from "./ai-planner.js";
import { initItineraryExport } from "./itinerary-export.js";
import { validateItinerary } from "../utils/validators.js";
import { api } from "../api.js";
import { $, escapeHTML as e, formatDate, mapsURL, safeImage } from "../components/ui.js";
import { bindMaps } from "./maps.js";
export const sampleItinerary = {
  titulo: "Nosso domingo, sem pressa.",
  descricao:
    "Um pouco de natureza, uma pausa para conversar e a cidade como cenário.",
  cidade: "Belo Horizonte",
  data: null,
  inicio: "09:00",
  fim: "15:00",
  chuva:
    "Trocar o parque por um café ou passeio cultural coberto. Conferir funcionamento antes de sair.",
  alimentacao:
    "Levar sanduíches, frutas e água para o piquenique. Verificar as regras do parque.",
  custos:
    "Definir após confirmar alimentação, transporte e eventuais ingressos.",
  recomendacoes: [
    "Horários ilustrativos; confirme o funcionamento e as condições de acesso.",
    "Fotos de inspiração: não representam necessariamente os locais sugeridos.",
    "Deslocamentos não calculados. Reserve uma margem entre as atividades.",
  ],
  etapas: [
    {
      nome: "Mirante das Mangabeiras",
      horario: "09:00",
      descricao:
        "Começar com a vista da cidade e algumas fotos. Conferir acesso e horário de abertura.",
      busca: "Mirante das Mangabeiras, Belo Horizonte",
    },
    {
      nome: "Parque das Mangabeiras",
      horario: "10:15",
      descricao:
        "Caminhar com calma e encontrar um cantinho para aproveitar a natureza.",
      busca: "Parque das Mangabeiras, Belo Horizonte",
    },
    {
      nome: "Piquenique no parque",
      horario: "12:00",
      descricao:
        "Sanduíches, frutas e uma boa conversa. A melhor parte é a companhia.",
      busca: "Parque das Mangabeiras, Belo Horizonte",
    },
    {
      nome: "Curtir o parque",
      horario: "13:00",
      descricao:
        "Sentar um pouco, descobrir novos caminhos e guardar mais um instante.",
      busca: "Parque das Mangabeiras, Belo Horizonte",
    },
    {
      nome: "Um sorvete juntos",
      horario: "14:00",
      descricao:
        "Escolher uma sorveteria próxima para adoçar o final do passeio.",
      busca: "Sorveteria, Mangabeiras, Belo Horizonte",
    },
    {
      nome: "Volta com calma",
      horario: "15:00",
      descricao:
        "Organizar o retorno com tranquilidade. E já pensar no próximo encontro.",
      busca: "Belo Horizonte",
    },
  ],
};
export function initItinerary() {
  let current = sampleItinerary,
    isExample = true,
    mode = "interactive",
    cleanup = () => { };
  const samplePhotos = [
    "landscape",
    "park",
    "picnic",
    "park",
    "icecream",
    "landscape",
  ];
  function render() {
    cleanup();
    $("#itinerary-notice").textContent = isExample
      ? "Uma ideia para se inspirar · Exemplo baseado na referência, sem evento cadastrado."
      : "Roteiro sugerido · Confirme locais, valores, funcionamento e deslocamentos antes de sair.";
    const metadata = [
      current.data ? formatDate(current.data) : "Um dia para nós",
      current.cidade,
      `${current.inicio}–${current.fim}`,
    ].join(" · ");
    $("#itinerary-output").innerHTML =
      `<article class="itinerary-paper ${mode === "poster" ? "poster-mode" : ""}"><header class="itinerary-title"><p class="eyebrow">MY BAE · JORGE & ANTONIA</p><h3>${e(current.titulo)}</h3><p>${e(metadata)}</p><p class="script">${e(current.descricao)}</p></header><div class="itinerary-steps">${current.etapas.map((step, i) => `<section class="itinerary-step"><span class="step-number">${i + 1}</span>${isExample ? `<img class="step-image" src="/assets/images/${samplePhotos[i]}.jpg" alt="Imagem de inspiração, não é uma fotografia do local" width="160" height="210" loading="lazy">` : safeImage(step.imagem_url) ? `<img class="step-image" src="${e(safeImage(step.imagem_url))}" alt="${e(step.nome)}" loading="lazy" width="160" height="210">` : '<div class="step-placeholder" role="img" aria-label="Ilustração decorativa, sem fotografia do local"><span>✧</span><small>Um novo lugar</small></div>'}<div class="step-content"><time class="time-tag">${e(step.horario)}</time><h4>${e(step.nome)}</h4><p>${e(step.descricao)}</p><a href="${e(mapsURL(step.busca))}" target="_blank" rel="noopener noreferrer">Pesquisar no Google Maps ↗</a><div class="location-controls" data-index="${i}"><label>Local ou endereço a verificar<input value="${e(step.busca)}" minlength="4" maxlength="300" required aria-label="Busca de localização: ${e(step.nome)}"></label><button type="button">Localizar no mapa ↗</button><p class="location-message" role="status"></p></div></div></section>`).join("")}</div><div class="map-section"><div class="map-empty">⌖ Localize e confirme as paradas para construir o mapa.<br>Nenhuma coordenada foi estimada pela IA.</div><div class="route-map" hidden aria-label="Mapa dos locais selecionados"></div><p class="map-note">Marcadores indicam locais selecionados. Percursos e tempos de deslocamento não calculados. Dados © OpenStreetMap.</p></div><div class="itinerary-extras"><div><h4>Se a chuva aparecer</h4><p>${e(current.chuva)}</p></div><div><h4>Uma pausa para comer</h4><p>${e(current.alimentacao)}</p></div><div><h4>Sobre os custos</h4><p>${e(current.custos)}</p></div><div><h4>Antes de sair</h4><ul>${current.recomendacoes.map((r) => `<li>${e(r)}</li>`).join("")}</ul></div></div><p class="poster-footer">${isExample ? "Roteiro ilustrativo · Fotografias de inspiração · " : "Sugestões sujeitas a confirmação · "}Mais um dia bonito para viver com você. ♡</p></article>`;
    cleanup = bindMaps($("#itinerary-output"), current);
  }
  function setItinerary(data, example = false) {
    current = validateItinerary(data);
    isExample = example;
    render();
  }
  function view(next) {
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
  render();
  let published = [];
  const ready = api("roteiros")
    .then((rows) => {
      published = rows;
      if (rows.length) {
        $("#saved-itineraries").innerHTML =
          '<div class="saved-choices" aria-label="Roteiros publicados"></div>';
        rows.forEach((row) => {
          const button = document.createElement("button");
          button.textContent = row.titulo;
          button.addEventListener("click", () => setItinerary(row.dados_json));
          $("#saved-itineraries>div").append(button);
        });
      }
    })
    .catch((error) => {
      $("#saved-itineraries").textContent = `Roteiros publicados: ${error.message}`;
    });
  return {
    setItinerary,
    async showForEvent(id) {
      await ready;
      const row = published.find((r) => String(r.encontro_id) === String(id));
      if (!row)
        throw new Error("Ainda não há roteiro publicado para este encontro.");
      setItinerary(row.dados_json);
      $("#roteiros").scrollIntoView({ behavior: "smooth" });
    },
  };
}
