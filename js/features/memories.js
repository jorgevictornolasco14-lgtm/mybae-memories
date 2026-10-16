import { api } from "../api.js";
import { $, escapeHTML as e, emptyState, loadSection, formatDate, safeImage } from "../components/ui.js";
export function initMemories() {
  return loadSection(
    $("#memory-list"),
    () => api("memorias"),
    (rows) => {
      rows.sort((a, b) => a.data_memoria.localeCompare(b.data_memoria));
      $("#memory-list").innerHTML = rows.length
        ? rows
          .map(
            (row) =>
              `<article class="memory">${safeImage(row.imagem_url) ? `<img src="${e(row.imagem_url)}" alt="${e(row.titulo)}" width="150" height="150" loading="lazy">` : ""}<div><time datetime="${e(row.data_memoria)}">${e(formatDate(row.data_memoria))}</time><h3>${e(row.titulo)}${row.destaque ? " ♡" : ""}</h3><p>${e(row.descricao)}</p><small>${e(row.categoria)}</small></div></article>`,
          )
          .join("")
        : emptyState(
          "Toda história começa com um instante.",
          "As nossas memórias publicadas terão seu lugar aqui.",
        );
    },
    "Nosso livro ainda está sendo escrito.",
    "As memórias aparecerão aqui assim que o álbum estiver conectado e os primeiros capítulos forem publicados.",
  );
}
