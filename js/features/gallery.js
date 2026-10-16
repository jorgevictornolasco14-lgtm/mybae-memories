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
  let photos = [];
  let orderedPhotos = [];
  let invalidPhotoCount = 0;
  let index = 0;
  const dialog = $("#lightbox");
  const imageUrl = (row) => safeImage(row.imagem_url) || safeImage(row.url);
  const samePhoto = (a, b) => (a.id && b.id && a.id === b.id) ||
    (a.storage_path && b.storage_path && a.storage_path === b.storage_path);

  async function fetchLatestPhoto(row) {
    const latest = await api("galeria", { cache: "no-store" });
    return latest.find((candidate) => samePhoto(row, candidate)) ||
      latest.find((candidate) => candidate.imagem_url === row.imagem_url || candidate.url === row.url);
  }

  function showImageError(card, img, row) {
    img.hidden = true;
    if (card.querySelector(".photo-image-error")) return;
    const message = document.createElement("span");
    message.className = "photo-image-error";
    message.setAttribute("role", "status");
    const text = document.createElement("span");
    text.textContent = "Não foi possível carregar esta fotografia.";
    const retry = document.createElement("span");
    retry.setAttribute("role", "button");
    retry.tabIndex = 0;
    retry.className = "photo-image-retry";
    retry.textContent = "Tentar novamente";
    const retryImage = async (event) => {
      event.stopPropagation();
      message.remove();
      img.hidden = false;
      delete img.dataset.refreshed;
      await refreshCardImage(row, img, card, true);
    };
    retry.addEventListener("click", retryImage);
    retry.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); retryImage(event); }
    });
    message.append(text, retry);
    card.insertBefore(message, card.firstChild);
  }

  async function refreshCardImage(row, img, card, manual = false) {
    if (img.dataset.refreshing === "true") return;
    if (!manual && img.dataset.refreshed === "true") {
      showImageError(card, img, row);
      return;
    }
    img.dataset.refreshed = "true";
    img.dataset.refreshing = "true";
    try {
      const latest = await fetchLatestPhoto(row);
      const nextUrl = latest && imageUrl(latest);
      if (nextUrl && nextUrl !== img.src) {
        Object.assign(row, latest);
        img.src = nextUrl;
        return;
      }
      showImageError(card, img, row);
    } catch {
      showImageError(card, img, row);
    } finally { img.dataset.refreshing = "false"; }
  }

  async function refreshLightboxImage(row, img) {
    if (img.dataset.refreshed === "true") {
      $("#lightbox-caption").textContent += " · Não foi possível carregar a fotografia. Feche e tente novamente.";
      return;
    }
    img.dataset.refreshed = "true";
    try {
      const latest = await fetchLatestPhoto(row);
      const nextUrl = latest && imageUrl(latest);
      if (nextUrl && nextUrl !== img.src) { Object.assign(row, latest); img.src = nextUrl; return; }
      $("#lightbox-caption").textContent += " · Não foi possível carregar a fotografia. Feche e tente novamente.";
    } catch {
      $("#lightbox-caption").textContent += " · Não foi possível atualizar a fotografia. Verifique sua conexão.";
    }
  }

  function open(i) {
    if (!orderedPhotos.length) return;
    index = (i + orderedPhotos.length) % orderedPhotos.length;
    const row = orderedPhotos[index];
    const lightboxImage = $("#lightbox-image");
    lightboxImage.dataset.refreshed = "false";
    lightboxImage.onerror = () => refreshLightboxImage(row, lightboxImage);
    lightboxImage.src = imageUrl(row);
    lightboxImage.alt = row.descricao || row.legenda || "Fotografia do álbum";
    $("#lightbox-caption").textContent = [row.legenda, formatDate(row.data_foto)].filter(Boolean).join(" · ");
    if (!dialog.open) dialog.showModal();
  }

  function render() {
    const sort = $("#gallery-sort").value;
    orderedPhotos = [...photos].sort((a, b) => {
      if (sort === "caption") return String(a.legenda || "").localeCompare(String(b.legenda || ""), "pt-BR");
      const aDate = Date.parse(a.created_at || a.data_foto || "") || 0;
      const bDate = Date.parse(b.created_at || b.data_foto || "") || 0;
      return sort === "oldest" ? aDate - bDate : bDate - aDate;
    });
    const grid = $("#gallery-grid");
    grid.innerHTML = `${invalidPhotoCount ? `<p class="gallery-data-warning" role="status">${invalidPhotoCount} fotografia(s) vieram com endereço inválido e não foram exibidas.</p>` : ""}${orderedPhotos.length
      ? orderedPhotos.map((row, i) =>
        `<button class="photo-card" data-index="${i}" aria-label="Ampliar ${e(row.legenda || "fotografia")}"><img src="${e(imageUrl(row))}" alt="${e(row.descricao || row.legenda || "Fotografia do álbum")}" loading="lazy" width="400" height="300"><span>${e(row.legenda || "Um instante nosso")}</span><small>${e(formatDate(row.data_foto))}</small></button>`,
      ).join("")
      : emptyState("As nossas melhores páginas ainda vêm.", "Adicione uma fotografia para começar este álbum.")}`;
    grid.querySelectorAll("button[data-index]").forEach((button) => {
      const row = orderedPhotos[Number(button.dataset.index)];
      button.addEventListener("click", () => open(Number(button.dataset.index)));
      button.querySelector("img").addEventListener("error", (event) => refreshCardImage(row, event.currentTarget, button));
    });
  }

  $("#gallery-sort").addEventListener("change", render);
  $("#lightbox-close").addEventListener("click", () => dialog.close());
  $("#lightbox-prev").addEventListener("click", () => open(index - 1));
  $("#lightbox-next").addEventListener("click", () => open(index + 1));
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") open(index - 1);
    if (event.key === "ArrowRight") open(index + 1);
  });
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });

  async function refreshGallery() {
    return loadSection(
      $("#gallery-grid"),
      () => api("galeria", { cache: "no-store" }),
      (data) => {
        photos = data.filter((row) => imageUrl(row));
        invalidPhotoCount = data.length - photos.length;
        render();
      },
      "Não foi possível abrir a galeria.",
      "O serviço da galeria está indisponível. Tente novamente em instantes.",
    );
  }

  await refreshGallery();
  return refreshGallery;
}
