import { api } from "./api.js";
import { $, escapeHTML as e, formatDate, mapsURL } from "./ui.js";
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
    cleanup = () => {};
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
      `<article class="itinerary-paper ${mode === "poster" ? "poster-mode" : ""}"><header class="itinerary-title"><p class="eyebrow">MY BAE · JORGE & ANTONIA</p><h3>${e(current.titulo)}</h3><p>${e(metadata)}</p><p class="script">${e(current.descricao)}</p></header><div class="itinerary-steps">${current.etapas.map((step, i) => `<section class="itinerary-step"><span class="step-number">${i + 1}</span>${isExample ? `<img class="step-image" src="/assets/images/${samplePhotos[i]}.jpg" alt="Imagem de inspiração, não é uma fotografia do local" width="160" height="210" loading="lazy">` : '<div class="step-placeholder" role="img" aria-label="Ilustração decorativa, sem fotografia do local"><span>✧</span><small>Um novo lugar</small></div>'}<div class="step-content"><time class="time-tag">${e(step.horario)}</time><h4>${e(step.nome)}</h4><p>${e(step.descricao)}</p><a href="${e(mapsURL(step.busca))}" target="_blank" rel="noopener noreferrer">Pesquisar no Google Maps ↗</a><div class="location-controls" data-index="${i}"><label>Local ou endereço a verificar<input value="${e(step.busca)}" minlength="4" maxlength="300" required aria-label="Busca de localização: ${e(step.nome)}"></label><button type="button">Localizar no mapa ↗</button><p class="location-message" role="status"></p></div></div></section>`).join("")}</div><div class="map-section"><div class="map-empty">⌖ Localize e confirme as paradas para construir o mapa.<br>Nenhuma coordenada foi estimada pela IA.</div><div class="route-map" hidden aria-label="Mapa dos locais selecionados"></div><p class="map-note">Marcadores indicam locais selecionados. Percursos e tempos de deslocamento não calculados. Dados © OpenStreetMap.</p></div><div class="itinerary-extras"><div><h4>Se a chuva aparecer</h4><p>${e(current.chuva)}</p></div><div><h4>Uma pausa para comer</h4><p>${e(current.alimentacao)}</p></div><div><h4>Sobre os custos</h4><p>${e(current.custos)}</p></div><div><h4>Antes de sair</h4><ul>${current.recomendacoes.map((r) => `<li>${e(r)}</li>`).join("")}</ul></div></div><p class="poster-footer">${isExample ? "Roteiro ilustrativo · Fotografias de inspiração · " : "Sugestões sujeitas a confirmação · "}Mais um dia bonito para viver com você. ♡</p></article>`;
    cleanup = bindMaps($("#itinerary-output"), current);
  }
  function setItinerary(data, example = false) {
    current = data;
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
  $("#planner-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button[type="submit"]'),
      status = $("#planner-status");
    button.disabled = true;
    button.textContent = "Imaginando um dia só nosso…";
    status.textContent =
      "Criando sugestões para vocês. Pode levar alguns instantes.";
    status.classList.remove("error");
    try {
      const data = await api("ai", {
        method: "POST",
        body: Object.fromEntries(new FormData(event.target)),
      });
      try {
        sessionStorage.setItem("mybae_generated", JSON.stringify(data));
      } catch {}
      setItinerary(data);
      status.textContent = "Nosso roteiro está pronto. Vamos descobrir?";
      $("#roteiros").scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("error");
    } finally {
      button.disabled = false;
      button.innerHTML = "Criar nosso roteiro com IA <span>✧</span>";
    }
  });
  async function exportImage(format) {
    const status = $("#export-status"),
      buttons = [$("#export-png"), $("#export-pdf")];
    buttons.forEach((b) => (b.disabled = true));
    status.textContent = "Preparando nosso pôster…";
    let clone, exportHost;
    try {
      if (!window.htmlToImage || !window.jspdf)
        throw new Error("A exportação não carregou. Atualize a página.");
      await document.fonts.ready;
      clone = $("#itinerary-output .itinerary-paper").cloneNode(true);
      clone.classList.add("poster-mode");
      exportHost = document.createElement("div");
      exportHost.style.cssText =
        "position:fixed;left:-12000px;top:0;width:900px;";
      exportHost.setAttribute("aria-hidden", "true");
      clone.style.cssText = "position:relative;width:900px;padding:40px;";
      clone
        .querySelectorAll(".location-controls,.map-section,.step-content>a")
        .forEach((node) => node.remove());
      clone.querySelector(".itinerary-steps").style.gridTemplateColumns =
        "1fr 1fr";
      exportHost.append(clone);
      document.body.append(exportHost);
      await Promise.all(
        [...clone.querySelectorAll("img")].map((img) => {
          img.loading = "eager";
          return img.decode();
        }),
      );
      const dataUrl = await htmlToImage.toPng(clone, {
        pixelRatio: 1.8,
        backgroundColor: "#fbf6ec",
        cacheBust: false,
        style: {
          position: "relative",
          left: "0",
          top: "0",
          margin: "0",
          transform: "none",
        },
      });
      if (format === "png") {
        const a = document.createElement("a");
        a.download = "nosso-roteiro-my-bae.png";
        a.href = dataUrl;
        a.click();
      } else {
        const img = new Image();
        img.src = dataUrl;
        await img.decode();
        const height = (img.height * 210) / img.width;
        const pdf = new jspdf.jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: [210, height],
          compress: true,
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext("2d").drawImage(img, 0, 0);
        pdf.addImage(
          canvas.toDataURL("image/jpeg", 0.94),
          "JPEG",
          0,
          0,
          210,
          height,
        );
        pdf.save("nosso-roteiro-my-bae.pdf");
      }
      status.textContent = "Pôster exportado com carinho.";
    } catch (error) {
      status.textContent = `Não foi possível exportar: ${error.message}`;
    } finally {
      exportHost?.remove();
      buttons.forEach((b) => (b.disabled = false));
    }
  }
  $("#export-png").addEventListener("click", () => exportImage("png"));
  $("#export-pdf").addEventListener("click", () => exportImage("pdf"));
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
    .catch(() => {});
  return {
    setItinerary,
    async showForEvent(id) {
      await ready;
      const row = published.find((r) => r.encontro_id === id);
      if (!row)
        throw new Error("Ainda não há roteiro publicado para este encontro.");
      setItinerary(row.dados_json);
      $("#roteiros").scrollIntoView({ behavior: "smooth" });
    },
  };
}
