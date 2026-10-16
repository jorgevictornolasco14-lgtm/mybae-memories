import { api } from "../api.js";
import {
  $,
  escapeHTML as e,
  emptyState,
  formatDate,
  loadSection,
  safeImage,
} from "../components/ui.js";
export async function initGallery() {
  let photos = [],
    index = 0;
  const dialog = $("#lightbox");
  function open(i) {
    if (!photos.length) return;
    index = (i + photos.length) % photos.length;
    const row = photos[index];
    $("#lightbox-image").src = safeImage(row.imagem_url);
    $("#lightbox-image").alt =
      row.descricao || row.legenda || "Fotografia do álbum";
    $("#lightbox-caption").textContent = [
      row.legenda,
      formatDate(row.data_foto),
    ]
      .filter(Boolean)
      .join(" · ");
    if (!dialog.open) dialog.showModal();
  }
  function render() {
    const sort = $("#gallery-sort").value;
    photos.sort((a, b) =>
      sort === "caption"
        ? String(a.legenda || "").localeCompare(String(b.legenda || ""), "pt-BR")
        : sort === "oldest"
          ? (a.data_foto || a.created_at || "").localeCompare(
            b.data_foto || b.created_at || "",
          )
          : (b.data_foto || b.created_at || "").localeCompare(
            a.data_foto || a.created_at || "",
          ),
    );
    $("#gallery-grid").innerHTML = photos.length
      ? photos
        .map(
          (row, i) =>
            `<button class="photo-card" data-index="${i}" aria-label="Ampliar ${e(row.legenda || "fotografia")}"><img src="${e(safeImage(row.imagem_url))}" alt="${e(row.descricao || row.legenda || "Fotografia do álbum")}" loading="lazy" width="400" height="300"><span>${e(row.legenda || "Um instante nosso")}</span><small>${e(formatDate(row.data_foto))}</small></button>`,
        )
        .join("")
      : emptyState(
        "As nossas melhores páginas ainda vêm.",
        "As fotografias aprovadas aparecerão aqui, uma memória de cada vez.",
      );
    $("#gallery-grid")
      .querySelectorAll("button[data-index]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          open(Number(button.dataset.index)),
        ),
      );
  }
  $("#gallery-sort").addEventListener("change", render);
  $("#lightbox-close").addEventListener("click", () => dialog.close());
  $("#lightbox-prev").addEventListener("click", () => open(index - 1));
  $("#lightbox-next").addEventListener("click", () => open(index + 1));
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") open(index - 1);
    if (event.key === "ArrowRight") open(index + 1);
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  async function refreshGallery() {
    const loaded = await loadSection(
    $("#gallery-grid"),
    () => api("galeria", { cache: "no-store" }),
    (data) => {
      photos = data.filter((row) => safeImage(row.imagem_url));
      render();
    },
    "Um álbum esperando por nós.",
    "Quando o álbum estiver conectado, as fotos publicadas aparecerão aqui.",
    );
    return loaded;
  }
  await refreshGallery();
  return refreshGallery;
}
