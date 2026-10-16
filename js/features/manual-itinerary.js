import { $, todayKey } from "../components/ui.js";
import { isDate, validateItinerary } from "../utils/validators.js";

const MAX_STEPS = 30;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function initManualItinerary(setItinerary) {
  const dialog = $("#manual-itinerary-dialog");
  const form = $("#manual-itinerary-form");
  const steps = $("#manual-steps");
  const addButton = $("#manual-add-step");
  const status = $("#manual-itinerary-status");
  let serial = 0;
  const photoUrls = new WeakMap();

  function stepField(label, name, type = "text", attrs = {}) {
    const wrapper = document.createElement("label");
    wrapper.textContent = label;
    const input = document.createElement("input");
    input.name = name;
    input.type = type;
    input.required = true;
    if (type === "time") input.required = true;
    for (const [key, value] of Object.entries(attrs)) input.setAttribute(key, value);
    wrapper.append(input);
    return wrapper;
  }

  function updateStepControls() {
    const rows = [...steps.querySelectorAll(".manual-step")];
    rows.forEach((row, i) => {
      row.querySelector(".manual-step-number").textContent = `Etapa ${i + 1}`;
      row.querySelector('[data-action="up"]').disabled = i === 0;
      row.querySelector('[data-action="down"]').disabled = i === rows.length - 1;
      row.querySelector('[data-action="remove"]').disabled = rows.length === 1;
      for (const button of row.querySelectorAll("[data-action]")) {
        const action = button.dataset.action;
        const labels = { up: "Mover etapa para cima", down: "Mover etapa para baixo", remove: "Remover etapa" };
        button.setAttribute("aria-label", `${labels[action]} ${i + 1}`);
      }
    });
    addButton.disabled = rows.length >= MAX_STEPS;
    $("#manual-step-limit").textContent = `${rows.length} de ${MAX_STEPS} etapas`;
  }

  function addStep(values = {}) {
    if (steps.children.length >= MAX_STEPS) return;
    const row = document.createElement("fieldset");
    row.className = "manual-step";
    const heading = document.createElement("div");
    heading.className = "manual-step-heading";
    const title = document.createElement("legend");
    title.className = "manual-step-number";
    const actions = document.createElement("div");
    actions.className = "manual-step-actions";
    for (const [action, text, label] of [["up", "↑", "Mover etapa para cima"], ["down", "↓", "Mover etapa para baixo"], ["remove", "×", "Remover etapa"]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.action = action;
      button.className = "icon-button manual-step-action";
      button.textContent = text;
      button.setAttribute("aria-label", label);
      actions.append(button);
    }
    heading.append(actions);
    const fields = document.createElement("div");
    fields.className = "form-grid";
    const time = stepField("Horário", "manual_horario", "time");
    const name = stepField("Nome do local", "manual_nome", "text", { minlength: "2", maxlength: "120" });
    const description = document.createElement("label");
    description.className = "span-2";
    description.textContent = "Descrição";
    const descriptionInput = document.createElement("textarea");
    descriptionInput.name = "manual_etapa_descricao";
    descriptionInput.required = true;
    descriptionInput.maxLength = 500;
    descriptionInput.rows = 2;
    description.append(descriptionInput);
    const address = stepField("Endereço para mapa", "manual_endereco", "text", { minlength: "4", maxlength: "300" });
    const photo = document.createElement("label");
    photo.className = "span-2";
    photo.textContent = "Fotografia (opcional)";
    const file = document.createElement("input");
    file.type = "file";
    file.name = "manual_fotografia";
    file.accept = "image/jpeg,image/png,image/webp";
    const hint = document.createElement("small");
    hint.className = "manual-photo-hint";
    hint.textContent = "JPEG, PNG ou WebP · até 5 MB. A foto fica apenas nesta visualização.";
    photo.append(file, hint);
    fields.append(time, name, description, address, photo);
    row.append(title, heading, fields);
    row.dataset.key = String(++serial);
    steps.append(row);
    for (const [key, value] of Object.entries(values)) {
      const input = row.elements?.[key] || row.querySelector(`[name="${key}"]`);
      if (input && typeof value === "string") input.value = value;
    }
    updateStepControls();
  }

  function buildItinerary() {
    if (!form.reportValidity()) return null;
    const data = Object.fromEntries([["titulo", "manual_titulo"], ["data_encontro", "manual_data"],
      ["cidade", "manual_cidade"], ["horario_inicio", "manual_inicio"], ["transporte", "manual_transporte"]]
      .map(([key, name]) => [key, form.elements[name].value]));
    data.descricao = form.elements.manual_descricao.value;
    const itinerarySteps = [...steps.querySelectorAll(".manual-step")].map((row) => {
      const get = (name) => row.querySelector(`[name="manual_${name}"]`);
      const file = get("fotografia").files[0];
      let imagem_preview_url = "";
      if (file) {
        if (!PHOTO_TYPES.has(file.type) || file.size > MAX_PHOTO_SIZE) {
          throw new Error("Cada fotografia deve ser JPEG, PNG ou WebP e ter até 5 MB.");
        }
        if (!photoUrls.has(file)) photoUrls.set(file, URL.createObjectURL(file));
        imagem_preview_url = photoUrls.get(file);
      }
      return {
        horario: get("horario").value,
        nome: get("nome").value.trim(),
        descricao: get("etapa_descricao").value.trim(),
        busca: get("endereco").value.trim(),
        ...(imagem_preview_url ? { imagem_url: imagem_preview_url } : {}),
      };
    });
    if (!isDate(data.data_encontro) || data.data_encontro < todayKey()) {
      throw new Error("Escolha uma data válida, a partir de hoje.");
    }
    if (!itinerarySteps.length || itinerarySteps.length > MAX_STEPS) {
      throw new Error(`Adicione de 1 a ${MAX_STEPS} etapas para visualizar o roteiro.`);
    }
    return validateItinerary({
      titulo: data.titulo.trim(),
      cidade: data.cidade.trim(),
      data: data.data_encontro,
      inicio: data.horario_inicio,
      fim: itinerarySteps[itinerarySteps.length - 1].horario,
      descricao: data.descricao.trim(),
      transporte: data.transporte.trim(),
      chuva: "",
      alimentacao: "",
      custos: "",
      recomendacoes: [],
      etapas: itinerarySteps,
    });
  }

  function preview() {
    status.textContent = "";
    status.classList.remove("error");
    try {
      const itinerary = buildItinerary();
      if (!itinerary) return;
      setItinerary(itinerary, false);
      status.textContent = "Prévia atualizada com as etapas informadas.";
      dialog.close();
      $("#roteiros").scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("error");
    }
  }

  $("#manual-itinerary-open").addEventListener("click", () => {
    status.textContent = "";
    status.classList.remove("error");
    if (!steps.children.length) addStep();
    dialog.showModal();
    form.elements.manual_titulo.focus();
  });
  $("#manual-itinerary-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  addButton.addEventListener("click", () => addStep());
  steps.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const row = button.closest(".manual-step");
    if (button.dataset.action === "remove") row.remove();
    if (button.dataset.action === "up" && row.previousElementSibling) steps.insertBefore(row, row.previousElementSibling);
    if (button.dataset.action === "down" && row.nextElementSibling) steps.insertBefore(row.nextElementSibling, row);
    updateStepControls();
  });
  $("#manual-preview").addEventListener("click", preview);
  $("#manual-save").addEventListener("click", () => {
    status.textContent = "";
    status.classList.remove("error");
    try {
      if (!buildItinerary()) return;
    } catch (error) {
      status.classList.add("error");
      status.textContent = error.message;
      return;
    }
    status.classList.add("error");
    status.textContent = "O backend publicado ainda não aceita POST /api/encontros (respondeu Allow: GET). Nada foi salvo. Seus dados continuam no formulário; é necessária uma rota de cadastro no backend para guardar e atualizar o calendário.";
  });
  addStep();
  form.elements.manual_data.min = todayKey();
}
