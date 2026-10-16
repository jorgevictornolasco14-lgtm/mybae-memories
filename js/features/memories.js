import { api } from "../api.js";
import { $, todayKey } from "../components/ui.js";

function dateParts(value) {
  const [year, month, day] = value.split("-").map(Number);
  const monthName = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day, 12))).replace(".", "").toLocaleUpperCase("pt-BR");
  return { year, month: monthName, day: String(day).padStart(2, "0") };
}

function memoryCard(row, deleteButton = null) {
  const card = document.createElement("article");
  card.className = "memory-card";
  const top = document.createElement("div");
  top.className = "memory-card-top";
  const time = document.createElement("time");
  time.className = "memory-date";
  time.dateTime = row.data_memoria;
  const date = dateParts(row.data_memoria);
  const day = document.createElement("span");
  day.className = "memory-day";
  day.textContent = date.day;
  const month = document.createElement("span");
  month.className = "memory-month";
  month.textContent = date.month;
  const year = document.createElement("span");
  year.className = "memory-year";
  year.textContent = String(date.year);
  time.append(day, month, year);
  const heart = document.createElement("span");
  heart.className = "memory-heart";
  heart.setAttribute("aria-hidden", "true");
  heart.textContent = "♡";
  top.append(time, heart);
  if (deleteButton) top.append(deleteButton);
  const title = document.createElement("h3");
  title.textContent = row.titulo;
  card.append(top, title);
  if (row.descricao) {
    const description = document.createElement("p");
    description.textContent = row.descricao;
    card.append(description);
  }
  return card;
}

export function initMemories(adminDeletion) {
  const list = $("#memory-list");
  let records = [];
  function renderRows() {
    records.sort((a, b) => b.data_memoria.localeCompare(a.data_memoria));
    if (records.length) {
      list.replaceChildren(...records.map((row) => memoryCard(row, adminDeletion?.createTrashButton(
        "memoria", row, async (id) => {
          records = records.filter((memory) => String(memory.id) !== String(id));
          renderRows();
          const feedback = $("#memory-delete-feedback");
          try {
            const latest = await api("memorias", { cache: "no-store" });
            records = latest.filter((memory) => String(memory.id) !== String(id));
            renderRows();
            feedback.hidden = false;
            feedback.textContent = "Memórias atualizadas após a confirmação do servidor.";
          } catch {
            feedback.hidden = false;
            feedback.textContent = "Exclusão confirmada. A lista foi atualizada localmente; recarregue para consultar o servidor novamente.";
          }
        }, renderRows,
      ))));
    } else {
      const empty = document.createElement("div");
      empty.className = "empty-state memory-empty";
      const icon = document.createElement("span");
      icon.className = "empty-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "♡";
      const title = document.createElement("h3");
      title.textContent = "Toda história começa com um instante.";
      const description = document.createElement("p");
      description.textContent = "Guarde aqui o primeiro momento que fez vocês sorrirem.";
      empty.append(icon, title, description);
      list.replaceChildren(empty);
    }
  }
  async function refreshMemories() {
    list.setAttribute("aria-busy", "true");
    list.replaceChildren(Object.assign(document.createElement("p"), {
      className: "memory-loading",
      textContent: "Abrindo nosso livro de memórias…",
    }));
    try {
      records = await api("memorias", { cache: "no-store" });
      renderRows();
      return true;
    } catch (error) {
      const message = document.createElement("p");
      message.className = "memory-error";
      message.setAttribute("role", "status");
      message.textContent = error.status === 503
        ? "As memórias estão temporariamente indisponíveis. Tente novamente em instantes."
        : error.message || "Não foi possível carregar as memórias.";
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "text-link memory-retry";
      retry.textContent = "Tentar novamente";
      retry.addEventListener("click", refreshMemories);
      list.replaceChildren(message, retry);
      return false;
    } finally { list.setAttribute("aria-busy", "false"); }
  }
  $("#memory-authorize-delete").addEventListener("click", () =>
    adminDeletion?.openAuthorization("memoria", records, renderRows));
  return refreshMemories;
}

export function initMemoryCreate(refreshMemories) {
  const dialog = $("#memory-dialog");
  const form = $("#memory-form");
  const submit = $("#memory-submit");
  const status = $("#memory-form-status");
  const feedback = $("#memory-feedback");
  const description = form.elements.descricao;
  let saving = false;

  function clearStatus() {
    status.textContent = "";
    status.classList.remove("error");
  }
  function closeAndReset() {
    dialog.close();
    form.reset();
    clearStatus();
    $("#memory-char-count").textContent = "0 / 1.000";
  }

  $("#memory-add").addEventListener("click", () => {
    feedback.hidden = true;
    clearStatus();
    form.elements.data_memoria.value = todayKey();
    dialog.showModal();
    form.elements.titulo.focus();
  });
  $("#memory-close").addEventListener("click", () => { if (!saving) closeAndReset(); });
  $("#memory-cancel").addEventListener("click", () => { if (!saving) closeAndReset(); });
  dialog.addEventListener("cancel", (event) => { if (saving) event.preventDefault(); });
  dialog.addEventListener("click", (event) => { if (event.target === dialog && !saving) closeAndReset(); });
  description.addEventListener("input", () => {
    $("#memory-char-count").textContent = `${description.value.length.toLocaleString("pt-BR")} / 1.000`;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (saving) return;
    clearStatus();
    if (!form.reportValidity()) return;
    const body = {
      titulo: form.elements.titulo.value.trim(),
      data_memoria: form.elements.data_memoria.value,
      descricao: description.value.trim(),
    };
    if (body.titulo.length < 2 || !body.data_memoria || !body.descricao) {
      status.textContent = "Preencha o título, a data e o que aconteceu.";
      status.classList.add("error");
      return;
    }

    saving = true;
    submit.disabled = true;
    $("#memory-close").disabled = true;
    $("#memory-cancel").disabled = true;
    submit.textContent = "Guardando…";
    feedback.hidden = true;
    try {
      await api("memoriaCreate", { method: "POST", body, expectedStatus: 201 });
      closeAndReset();
      feedback.textContent = "Memória guardada com carinho! ♡";
      feedback.hidden = false;
      if (!await refreshMemories()) {
        feedback.textContent = "Memória salva, mas não foi possível atualizar a lista agora. Tente novamente.";
      }
    } catch (error) {
      status.textContent = error.status === 405
        ? "O backend ainda não habilita POST /api/memorias (respondeu 405, Allow: GET). A memória não foi salva."
        : error.status === 503
          ? "O serviço de memórias está temporariamente indisponível. Tente novamente em instantes."
          : error.message || "Não foi possível guardar a memória. Confira os dados e tente novamente.";
      status.classList.add("error");
    } finally {
      saving = false;
      submit.disabled = false;
      submit.textContent = "Guardar memória ♡";
      $("#memory-close").disabled = false;
      $("#memory-cancel").disabled = false;
    }
  });
}
