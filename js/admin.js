import { api } from "./api.js";
import { $, escapeHTML as e, emptyState } from "./ui.js";
const fields = {
  memorias: {
    titulo: ["Título", "text"],
    descricao: ["Descrição", "textarea"],
    data_memoria: ["Data da memória", "date"],
    imagem_url: ["Imagem pública (Storage ou /assets/)", "text"],
    categoria: ["Categoria", "text"],
    destaque: ["Destaque", "checkbox"],
    publicado: ["Publicado", "checkbox"],
  },
  fotos: {
    storage_path: ["Caminho do arquivo (gerado no envio)", "readonly"],
    legenda: ["Legenda", "text"],
    descricao: ["Descrição acessível", "textarea"],
    data_foto: ["Data da fotografia", "date"],
    publicado: ["Publicado", "checkbox"],
  },
  encontros: {
    titulo: ["Título", "text"],
    data_encontro: ["Data", "date"],
    horario_inicio: ["Início", "time"],
    horario_fim: ["Término (opcional)", "time"],
    cidade: ["Cidade", "text"],
    local: ["Local", "text"],
    endereco: ["Endereço", "text"],
    descricao: ["Descrição", "textarea"],
    preferencias: ["Preferências", "textarea"],
    orcamento: ["Orçamento (opcional)", "number"],
    status: ["Status", ["Planejado", "Confirmado", "Realizado", "Cancelado"]],
    publicado: ["Publicado", "checkbox"],
  },
  roteiros: {
    titulo: ["Título", "text"],
    descricao: ["Descrição", "textarea"],
    encontro_id: ["Encontro associado (opcional)", [""]],
    dados_json: ["Roteiro estruturado (JSON)", "json"],
    versao: ["Versão", "number"],
    publicado: ["Publicado", "checkbox"],
  },
  configuracoes: {
    nome_site: ["Nome do site", "text"],
    nome_pessoa_1: ["Primeiro nome", "text"],
    nome_pessoa_2: ["Segundo nome", "text"],
    data_inicio_relacionamento: ["Data real do início (opcional)", "date"],
    mensagem_principal: ["Mensagem da capa", "textarea"],
    imagem_capa: ["Imagem de capa pública (Storage ou /assets/)", "text"],
  },
};
let csrf,
  rows = [],
  editing = null,
  table = "memorias",
  encounters = [],
  previewURL;
async function load() {
  $("#admin-status").textContent = "Carregando…";
  table = $("#collection").value;
  $("#upload-panel").hidden = table !== "fotos";
  $("#new-record").hidden = table === "fotos";
  try {
    rows = await api(`admin/content?table=${table}`);
    if (table === "roteiros")
      encounters = await api("admin/content?table=encontros");
    $("#admin-list").innerHTML = rows.length
      ? rows
          .map(
            (row, i) =>
              `<article class="admin-row">${row.imagem_url ? `<img src="${e(row.imagem_url)}" alt="${e(row.legenda)}">` : ""}<div><h3>${e(row.titulo || row.legenda || row.nome_site || "Fotografia sem legenda")}</h3><p>${table === "configuracoes" ? "Configurações públicas" : row.publicado ? "Publicado" : "Rascunho · visível somente na administração"}</p></div><button class="button outline" data-index="${i}">Editar ↗</button></article>`,
          )
          .join("")
      : emptyState(
          "Tudo pronto para um novo capítulo.",
          "Adicione o primeiro registro. Ele só será público quando você marcar “Publicado”.",
        );
    $("#admin-list")
      .querySelectorAll("button")
      .forEach((b) =>
        b.addEventListener("click", () => edit(rows[Number(b.dataset.index)])),
      );
    $("#admin-status").textContent = "";
  } catch (error) {
    $("#admin-status").textContent = error.message;
    if (error.status === 401) signedOut();
  }
}
function edit(row = {}) {
  editing = row.id || null;
  $("#editor-title").textContent = editing
    ? "Cuidar deste registro"
    : "Criar um novo capítulo";
  $("#editor-status").textContent = "";
  $("#delete-record").hidden = !editing || table === "configuracoes";
  $("#editor-fields").innerHTML = Object.entries(fields[table])
    .map(([key, [label, type]]) => {
      let value =
        row[key] ??
        (key === "versao" ? 1 : key === "status" ? "Planejado" : "");
      if (key === "dados_json" && value) value = JSON.stringify(value, null, 2);
      let control;
      if (key === "encontro_id")
        control = `<select name="${key}"><option value="">Sem encontro associado</option>${encounters.map((r) => `<option value="${e(r.id)}" ${r.id === value ? "selected" : ""}>${e(r.titulo)} · ${e(r.data_encontro)}</option>`).join("")}</select>`;
      else if (Array.isArray(type))
        control = `<select name="${key}">${type.map((v) => `<option ${v === value ? "selected" : ""}>${e(v)}</option>`).join("")}</select>`;
      else if (type === "checkbox")
        control = `<input name="${key}" type="checkbox" ${value ? "checked" : ""}>`;
      else if (type === "textarea" || type === "json")
        control = `<textarea name="${key}" ${type === "json" ? 'rows="15" spellcheck="false"' : ""} maxlength="${type === "json" ? 30000 : 3000}">${e(value)}</textarea>`;
      else
        control = `<input name="${key}" type="${type === "readonly" ? "text" : type}" ${type === "readonly" ? "readonly" : ""} value="${e(type === "time" ? String(value).slice(0, 5) : value)}" ${type === "number" ? 'min="0" step="0.01"' : ""} maxlength="1500">`;
      return `<label class="${["textarea", "json"].includes(type) ? "wide" : ""}">${e(label)}${control}</label>`;
    })
    .join("");
  if (table === "roteiros") {
    const note = document.createElement("p");
    note.className = "wide";
    note.textContent =
      "Copie o JSON de um roteiro gerado no site. Revise locais, horários e publicação antes de salvar. Coordenadas fornecidas pela IA não são aceitas.";
    $("#editor-fields").prepend(note);
    const importButton = document.createElement("button");
    importButton.type = "button";
    importButton.className = "button outline wide";
    importButton.textContent = "Importar último roteiro gerado nesta sessão";
    importButton.addEventListener("click", () => {
      const data = sessionStorage.getItem("mybae_generated");
      if (!data) {
        $("#editor-status").textContent =
          "Gere um roteiro na página pública, nesta mesma aba, e volte à administração.";
        return;
      }
      try {
        const parsed = JSON.parse(data);
        $('#edit-form [name="dados_json"]').value = JSON.stringify(
          parsed,
          null,
          2,
        );
        $('#edit-form [name="titulo"]').value = parsed.titulo;
        $('#edit-form [name="descricao"]').value = parsed.descricao;
      } catch {
        $("#editor-status").textContent =
          "Não foi possível importar o roteiro.";
      }
    });
    $("#editor-fields").prepend(importButton);
  }
  $("#edit-dialog").showModal();
}
function signedOut() {
  csrf = null;
  $("#admin-panel").hidden = true;
  $("#login-form").hidden = false;
  $("#logout").hidden = true;
}
async function signedIn(token) {
  csrf = token;
  $("#login-form").hidden = true;
  $("#admin-panel").hidden = false;
  $("#logout").hidden = false;
  await load();
}
$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const b = event.target.querySelector("button");
  b.disabled = true;
  try {
    const result = await api("admin/session", {
      method: "POST",
      body: Object.fromEntries(new FormData(event.target)),
    });
    event.target.reset();
    await signedIn(result.csrf);
  } catch (error) {
    $("#admin-status").textContent = error.message;
  } finally {
    b.disabled = false;
  }
});
$("#logout").addEventListener("click", async () => {
  try {
    await api("admin/session", { method: "DELETE", csrf });
    signedOut();
  } catch (error) {
    $("#admin-status").textContent = error.message;
  }
});
$("#collection").addEventListener("change", load);
$("#new-record").addEventListener("click", () => edit());
$("#close-editor").addEventListener("click", () => $("#edit-dialog").close());
$("#edit-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const b = event.target.querySelector('[type="submit"]');
  b.disabled = true;
  $("#editor-status").textContent = "Salvando…";
  try {
    const data = {};
    const form = new FormData(event.target);
    for (const [key, [, type]] of Object.entries(fields[table])) {
      let value = form.get(key);
      if (type === "checkbox") value = event.target.elements[key].checked;
      else if (type === "json") value = JSON.parse(value);
      else if (type === "number") value = value === "" ? null : Number(value);
      else if (
        (type === "date" && value === "") ||
        (["horario_fim", "encontro_id"].includes(key) && !value)
      )
        value = null;
      data[key] = value;
    }
    await api("admin/content", {
      method: "POST",
      csrf,
      body: { table, id: editing, data, action: "save" },
    });
    $("#edit-dialog").close();
    await load();
    $("#admin-status").textContent = "Alterações salvas.";
  } catch (error) {
    $("#editor-status").textContent =
      error instanceof SyntaxError
        ? "O JSON não é válido. Confira a estrutura do roteiro."
        : error.message;
  } finally {
    b.disabled = false;
  }
});
$("#delete-record").addEventListener("click", async () => {
  if (!confirm("Excluir este registro permanentemente?")) return;
  const b = $("#delete-record");
  b.disabled = true;
  try {
    await api("admin/content", {
      method: "POST",
      csrf,
      body: { table, id: editing, action: "delete" },
    });
    $("#edit-dialog").close();
    await load();
  } catch (error) {
    $("#editor-status").textContent = error.message;
  } finally {
    b.disabled = false;
  }
});
$("#photo-file").addEventListener("change", () => {
  const file = $("#photo-file").files[0];
  if (previewURL) URL.revokeObjectURL(previewURL);
  $("#upload-photo").disabled = true;
  $("#upload-preview").hidden = true;
  if (!file) return;
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 2800000
  ) {
    $("#admin-status").textContent =
      "Selecione JPG, PNG ou WebP de até 2,8 MB.";
    return;
  }
  previewURL = URL.createObjectURL(file);
  $("#upload-preview").src = previewURL;
  $("#upload-preview").hidden = false;
  $("#upload-photo").disabled = false;
});
$("#upload-photo").addEventListener("click", async () => {
  const b = $("#upload-photo");
  b.disabled = true;
  $("#admin-status").textContent = "Enviando fotografia…";
  try {
    const file = $("#photo-file").files[0];
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const row = await api("admin/upload", {
      method: "POST",
      csrf,
      body: { base64, type: file.type },
    });
    $("#photo-file").value = "";
    $("#upload-preview").hidden = true;
    await load();
    edit(row);
  } catch (error) {
    $("#admin-status").textContent = error.message;
    b.disabled = false;
  }
});
try {
  const result = await api("admin/session");
  await signedIn(result.csrf);
} catch (error) {
  signedOut();
  if (error.status !== 401) $("#admin-status").textContent = error.message;
}
