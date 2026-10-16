import { uploadGalleryPhoto } from "../api.js";
import { $ } from "../components/ui.js";

const MAX_FILE_SIZE = 2.8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function initGalleryUpload(refreshGallery) {
  const dialog = $("#gallery-upload-dialog");
  const form = $("#gallery-upload-form");
  const fileInput = $("#upload-file");
  const previewWrap = $("#upload-preview-wrap");
  const preview = $("#upload-preview");
  const submit = $("#upload-submit");
  const closeButton = $("#upload-close");
  const cancelButton = $("#upload-cancel");
  const status = $("#upload-status");
  const feedback = $("#gallery-upload-feedback");
  let previewUrl = "";
  let submitting = false;

  function clearPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = "";
    preview.removeAttribute("src");
    previewWrap.hidden = true;
  }
  function setError(message) {
    status.textContent = message;
    status.classList.add("error");
  }
  function validateFile(file) {
    if (!file) return "Escolha uma fotografia para continuar.";
    if (!ALLOWED_TYPES.has(file.type)) return "Use uma imagem JPEG, PNG ou WebP.";
    if (file.size > MAX_FILE_SIZE) return "A fotografia deve ter até 2,8 MB.";
    return "";
  }
  function showPreview(file) {
    clearPreview();
    const error = validateFile(file);
    if (error) { setError(error); fileInput.value = ""; return; }
    status.textContent = "";
    status.classList.remove("error");
    previewUrl = URL.createObjectURL(file);
    preview.src = previewUrl;
    previewWrap.hidden = false;
  }
  function reset() {
    form.reset();
    clearPreview();
    status.textContent = "";
    status.classList.remove("error");
    submit.disabled = false;
    submit.textContent = "Publicar foto ♡";
  }

  $("#gallery-add-photo").addEventListener("click", () => {
    feedback.hidden = true;
    status.textContent = "";
    const date = form.elements.data_foto;
    date.value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    dialog.showModal();
    fileInput.focus();
  });
  closeButton.addEventListener("click", () => { if (!submitting) dialog.close(); });
  cancelButton.addEventListener("click", () => { if (!submitting) dialog.close(); });
  dialog.addEventListener("cancel", (event) => { if (submitting) event.preventDefault(); });
  dialog.addEventListener("close", () => { if (!submitting) reset(); });
  dialog.addEventListener("click", (event) => { if (event.target === dialog && !submitting) dialog.close(); });
  fileInput.addEventListener("change", () => showPreview(fileInput.files[0]));
  $("#upload-remove").addEventListener("click", () => { fileInput.value = ""; clearPreview(); fileInput.focus(); });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitting) return;
    status.textContent = "";
    status.classList.remove("error");
    const file = fileInput.files[0];
    const validationError = validateFile(file);
    if (validationError) { setError(validationError); fileInput.focus(); return; }
    if (!form.reportValidity()) return;

    submitting = true;
    submit.disabled = true;
    closeButton.disabled = true;
    cancelButton.disabled = true;
    submit.textContent = "Publicando…";
    const data = new FormData();
    data.append("file", file);
    data.append("legenda", form.elements.legenda.value.trim());
    data.append("descricao", form.elements.descricao.value.trim());
    data.append("data_foto", form.elements.data_foto.value);
    try {
      await uploadGalleryPhoto(data);
      dialog.close();
      reset();
      feedback.textContent = "Fotografia publicada com carinho! ♡";
      feedback.hidden = false;
      try { if (!await refreshGallery()) throw new Error("Falha ao atualizar"); }
      catch { feedback.textContent = "Fotografia publicada com carinho! ♡ Não foi possível atualizar a galeria agora; tente recarregar a página."; }
    } catch (error) {
      setError(error.message || "Não foi possível publicar a fotografia. Confira sua conexão e tente novamente.");
    } finally {
      submitting = false;
      closeButton.disabled = false;
      cancelButton.disabled = false;
      if (dialog.open) { submit.disabled = false; submit.textContent = "Publicar foto ♡"; }
    }
  });
}
