import { api } from "../api.js";
import { $ } from "../components/ui.js";

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_CAPABILITY_LIFETIME = 8 * 60 * 1000;

export function initAdminDeletion() {
  const capabilities = new Map();
  const authorizationDialog = $("#admin-capability-dialog");
  const authorizationForm = $("#admin-capability-form");
  const selector = $("#admin-capability-item");
  const tokenInput = $("#admin-capability-token");
  const command = $("#admin-capability-command");
  const authorizationStatus = $("#admin-capability-status");
  const confirmDialog = $("#content-delete-dialog");
  const confirmStatus = $("#content-delete-status");
  let authorizationContext = null;
  let pendingDelete = null;
  let sending = false;

  const key = (type, id) => `${type}:${id}`;
  const typeLabel = (type) => type === "foto" ? "fotografia" : "memória";
  const titleOf = (type, row) => type === "foto" ? (row.legenda || "Fotografia") : row.titulo;

  function updateCommand() {
    if (!authorizationContext || !selector.value) { command.value = ""; return; }
    command.value = `npm run admin:capability -- --type ${authorizationContext.type} --id ${selector.value}`;
  }

  function openAuthorization(type, records, onChange) {
    authorizationContext = { type, records, onChange };
    selector.replaceChildren();
    const eligible = records.filter((row) => UUID.test(String(row.id || "")));
    if (!eligible.length) {
      selector.add(new Option("Nenhum registro com ID válido para autorizar", ""));
      selector.disabled = true;
      authorizationStatus.textContent = "A API precisa retornar o UUID do item para habilitar a exclusão.";
      authorizationStatus.classList.add("error");
    } else {
      selector.disabled = false;
      selector.add(new Option("Escolha o conteúdo", ""));
      eligible.forEach((row) => {
        const label = `${titleOf(type, row)} · ${row.id}`;
        selector.add(new Option(label, String(row.id)));
      });
      authorizationStatus.textContent = "";
      authorizationStatus.classList.remove("error");
    }
    tokenInput.value = "";
    updateCommand();
    authorizationDialog.showModal();
    if (eligible.length) selector.focus();
  }

  function createTrashButton(type, row, onDeleted, onCapabilityChange) {
    if (!row.id || !capabilities.has(key(type, row.id))) return null;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "content-delete-button";
    button.setAttribute("aria-label", `Excluir ${typeLabel(type)}`);
    button.title = `Excluir ${typeLabel(type)}`;
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 4v5m4-5v5");
    icon.append(path);
    button.append(icon);
    button.addEventListener("click", () => {
      if (sending) return;
      pendingDelete = { type, row, onDeleted, onCapabilityChange };
      const kind = typeLabel(type);
      $("#content-delete-description").textContent = `Você está prestes a excluir ${kind}: “${titleOf(type, row)}”. Esta ação não pode ser desfeita.`;
      confirmStatus.textContent = "";
      confirmStatus.classList.remove("error");
      confirmDialog.showModal();
      $("#content-delete-confirm").focus();
    });
    return button;
  }

  selector.addEventListener("change", updateCommand);
  $("#admin-capability-copy").addEventListener("click", async () => {
    if (!command.value) return;
    try { await navigator.clipboard.writeText(command.value); }
    catch { command.select(); document.execCommand("copy"); }
    authorizationStatus.textContent = "Comando copiado. Execute-o no repositório mybae-backend e cole o token abaixo.";
    authorizationStatus.classList.remove("error");
  });
  $("#admin-capability-close").addEventListener("click", () => authorizationDialog.close());
  $("#admin-capability-cancel").addEventListener("click", () => authorizationDialog.close());
  authorizationDialog.addEventListener("close", () => { tokenInput.value = ""; });
  authorizationForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!authorizationContext || !selector.value) {
      authorizationStatus.textContent = "Escolha o conteúdo que receberá a autorização.";
      authorizationStatus.classList.add("error");
      return;
    }
    if (!TOKEN.test(tokenInput.value)) {
      authorizationStatus.textContent = "Cole a capacidade temporária completa gerada pelo backend.";
      authorizationStatus.classList.add("error");
      return;
    }
    const item = authorizationContext.records.find((row) => String(row.id) === selector.value);
    if (!item) return;
    const itemKey = key(authorizationContext.type, item.id);
    const previous = capabilities.get(itemKey);
    if (previous?.timer) clearTimeout(previous.timer);
    const entry = { token: tokenInput.value, timer: 0 };
    entry.timer = setTimeout(() => {
      capabilities.delete(itemKey);
      authorizationContext?.onChange?.();
    }, LOCAL_CAPABILITY_LIFETIME);
    capabilities.set(itemKey, entry);
    authorizationContext.onChange?.();
    tokenInput.value = "";
    authorizationDialog.close();
  });
  $("#content-delete-close").addEventListener("click", () => confirmDialog.close());
  $("#content-delete-cancel").addEventListener("click", () => confirmDialog.close());
  confirmDialog.addEventListener("cancel", (event) => { if (sending) event.preventDefault(); });
  $("#content-delete-confirm").addEventListener("click", async () => {
    if (sending || !pendingDelete) return;
    const { type, row, onDeleted, onCapabilityChange } = pendingDelete;
    const itemKey = key(type, row.id);
    const capability = capabilities.get(itemKey);
    if (!capability) {
      confirmStatus.textContent = "A autorização temporária expirou. Gere uma nova capacidade para este item.";
      confirmStatus.classList.add("error");
      onCapabilityChange?.();
      return;
    }
    capabilities.delete(itemKey);
    clearTimeout(capability.timer);
    onCapabilityChange?.();
    sending = true;
    const confirmButton = $("#content-delete-confirm");
    confirmButton.disabled = true;
    confirmButton.textContent = "Excluindo…";
    confirmStatus.textContent = "Aguardando confirmação do servidor…";
    confirmStatus.classList.remove("error");
    try {
      const result = type === "foto"
        ? await api("photoDelete", { method: "DELETE", query: { id: row.id }, headers: { "X-Admin-Capability": capability.token }, cache: "no-store" })
        : await api("memoryDelete", { method: "DELETE", body: { id: row.id }, headers: { "X-Admin-Capability": capability.token }, cache: "no-store" });
      await onDeleted(row.id, result.deleted);
      confirmStatus.textContent = result.deleted ? `${type === "foto" ? "Fotografia" : "Memória"} excluída.` : "O conteúdo já não existia; a lista foi atualizada.";
      confirmDialog.close();
    } catch (error) {
      confirmStatus.textContent = error.code === "MISSING_ADMIN_CAPABILITY_SECRET"
        ? "A exclus?o est? temporariamente indispon?vel: o backend ainda n?o configurou ADMIN_CAPABILITY_SECRET. O conte?do continua na lista."
        : error.code === "ADMIN_CAPABILITY_REQUIRED" || error.code === "ADMIN_CAPABILITY_REJECTED"
          ? "A autoriza??o tempor?ria foi recusada ou expirou. Gere uma nova capacidade. O conte?do continua na lista."
          : error.message || "N?o foi poss?vel excluir. O conte?do continua na lista.";
      confirmStatus.classList.add("error");
      onCapabilityChange?.();
    } finally {
      sending = false;
      confirmButton.disabled = false;
      confirmButton.textContent = "Sim, apagar";
    }
  });

  return {
    openAuthorization,
    createTrashButton,
  };
}
