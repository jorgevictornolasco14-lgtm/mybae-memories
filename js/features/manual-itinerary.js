import { $, todayKey } from "../components/ui.js";
import { isDate, validateItinerary } from "../utils/validators.js";
import { api } from "../api.js";
import { parseManualItineraryImport } from "./manual-itinerary-import.js";

const MAX_STEPS = 30;
const MAX_PUBLISHED_STEPS = 9;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function initManualItinerary(setItinerary) {
  const dialog = $("#manual-itinerary-dialog");
  const form = $("#manual-itinerary-form");
  const steps = $("#manual-steps");
  const addButton = $("#manual-add-step");
  const status = $("#manual-itinerary-status");
  const saveButton = $("#manual-save");
  const importButton = $("#manual-import-open");
  const importFile = $("#manual-import-file");
  const importConfirm = $("#manual-import-confirm");
  let pendingImport = null;
  let serial = 0;
  let saving = false;
  let saved = false;
  const photoUrls = new WeakMap();

  function unlockSavedSubmission() {
    if (!saved) return;
    saved = false;
    saveButton.disabled = false;
    saveButton.textContent = "Guardar nosso encontro ♡";
    status.textContent = "";
    status.classList.remove("error");
  }

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
      ["cidade", "manual_cidade"], ["horario_inicio", "manual_inicio"], ["horario_fim", "manual_fim"], ["transporte", "manual_transporte"]]
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
    if (data.horario_fim <= data.horario_inicio || itinerarySteps.some((step, index) =>
      step.horario < data.horario_inicio || step.horario >= data.horario_fim ||
      (index > 0 && step.horario < itinerarySteps[index - 1].horario))) {
      throw new Error("Confira o horário de término e a ordem dos horários das etapas.");
    }
    return validateItinerary({
      titulo: data.titulo.trim(),
      cidade: data.cidade.trim(),
      data: data.data_encontro,
      inicio: data.horario_inicio,
      fim: data.horario_fim,
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
  importButton.addEventListener("click", () => {
    importFile.value = "";
    importFile.click();
  });
  importFile.addEventListener("change", async () => {
    const file = importFile.files?.[0];
    if (!file) return;
    status.textContent = "";
    status.classList.remove("error");
    try {
      if (!file.name.toLowerCase().endsWith(".json")) throw new Error("Selecione um arquivo com extensão .json.");
      if (file.size > 256 * 1024) throw new Error("O arquivo JSON excede o limite de 256 KB.");
      const imported = parseManualItineraryImport(await file.text());
      pendingImport = imported;
      importConfirm.showModal();
      $("#manual-import-apply").focus();
    } catch (error) {
      status.textContent = error.message || "Não foi possível ler esse roteiro.";
      status.classList.add("error");
    }
  });
  function cancelImport() {
    pendingImport = null;
    importFile.value = "";
  }
  $("#manual-import-cancel").addEventListener("click", () => importConfirm.close());
  importConfirm.addEventListener("cancel", cancelImport);
  importConfirm.addEventListener("close", cancelImport);
  $("#manual-import-apply").addEventListener("click", () => {
    if (!pendingImport) return;
    const imported = pendingImport;
    form.reset();
    for (const name of ["manual_titulo", "manual_data", "manual_cidade", "manual_inicio", "manual_fim", "manual_transporte", "manual_descricao"])
      form.elements[name].value = imported[name];
    steps.replaceChildren();
    imported.steps.forEach((step) => addStep(step));
    updateStepControls();
    saved = false;
    saveButton.disabled = false;
    saveButton.textContent = "Guardar nosso encontro ♡";
    status.classList.remove("error");
    status.textContent = imported.photoFilesNeedReselection
      ? "Seu roteiro foi restaurado com sucesso ♡ As fotografias precisam ser selecionadas novamente."
      : "Seu roteiro foi restaurado com sucesso ♡ As fotografias precisam ser selecionadas novamente caso queira adicioná-las.";
    importConfirm.close();
    form.elements.manual_titulo.focus();
  });
  $("#manual-itinerary-close").addEventListener("click", () => dialog.close());
  form.addEventListener("input", unlockSavedSubmission);
  form.addEventListener("change", unlockSavedSubmission);
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
  saveButton.addEventListener("click", async () => {
    if (saving || saved) return;
    status.textContent = "";
    status.classList.remove("error");
    let itinerary;
    try {
      itinerary = buildItinerary();
      if (!itinerary) return;
      if (itinerary.etapas.length < 2) throw new Error("Adicione pelo menos duas etapas para guardar o encontro.");
      if (itinerary.etapas.length > MAX_PUBLISHED_STEPS)
        throw new Error(`O backend permite publicar até ${MAX_PUBLISHED_STEPS} etapas por encontro. Remova algumas etapas antes de guardar.`);
    } catch (error) {
      status.classList.add("error");
      status.textContent = error.message;
      return;
    }
    const transport = itinerary.transporte.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    const transportMap = transport.includes("aplic") || transport.includes("uber") || transport.includes("99") ? "Aplicativo"
      : transport.includes("transporte") || transport.includes("onibus") || transport.includes("metro") ? "Transporte público"
        : transport.includes("carro") ? "Carro"
          : transport === "a pe" || transport.includes("caminh") ? "A pé" : null;
    if (!transportMap) {
      status.classList.add("error");
      status.textContent = "Informe transporte como A pé, Carro, Transporte público ou Aplicativo.";
      return;
    }
    const payload = {
      titulo: itinerary.titulo,
      cidade: itinerary.cidade,
      data_encontro: itinerary.data,
      horario_inicio: itinerary.inicio,
      horario_fim: itinerary.fim,
      descricao: itinerary.descricao,
      tipo_passeio: "Personalizado",
      transporte: transportMap,
      etapas: itinerary.etapas.map((stage, index) => ({
        ordem: index + 1,
        horario: stage.horario,
        nome: stage.nome,
        descricao: stage.descricao,
        endereco: stage.busca,
      })),
    };
    const hasPhotos = [...steps.querySelectorAll('[name="manual_fotografia"]')].some((input) => input.files?.length);
    saving = true;
    saveButton.disabled = true;
    saveButton.setAttribute("aria-busy", "true");
    status.textContent = "Guardando seu encontro…";
    try {
      const result = await api("manualItineraryCreate", {
        body: payload,
        cache: "no-store",
        expectedStatus: 201,
        errorMessages: {
          400: "Confira os campos e horários do encontro. Seus dados continuam no formulário.",
          413: "O roteiro excede o limite aceito pelo servidor. Reduza o texto ou as etapas.",
          429: "O limite de cadastros foi atingido. Aguarde um pouco e tente novamente.",
          500: "O servidor não conseguiu salvar o encontro. Seus dados continuam no formulário.",
          503: "O serviço está temporariamente indisponível. Seus dados continuam no formulário; tente novamente mais tarde.",
        },
      });
      setItinerary(hasPhotos ? itinerary : result.roteiro.dados_json, false);
      saved = true;
      saveButton.textContent = "Encontro guardado ✓";
      status.classList.remove("error");
      status.textContent = hasPhotos
        ? "Encontro salvo e publicado. As fotografias escolhidas aparecem somente na prévia local; não enviamos URLs temporárias como imagens permanentes."
        : "Encontro salvo e publicado. A agenda foi atualizada; selecione a data para ver os detalhes.";
      window.dispatchEvent(new CustomEvent("mybae:meeting-created", {
        detail: { id: result.encontro.id, date: result.encontro.data_encontro },
      }));
    } catch (error) {
      status.classList.add("error");
      status.textContent = error.message || "Não foi possível salvar. Seus dados continuam no formulário.";
    } finally {
      saving = false;
      saveButton.removeAttribute("aria-busy");
      if (!saved) saveButton.disabled = false;
    }
  });
  addStep();
  form.elements.manual_data.min = todayKey();
}
