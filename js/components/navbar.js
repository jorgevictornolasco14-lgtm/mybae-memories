import { $ } from "./ui.js";
export function initNavbar() {
  const menu = $(".menu-toggle");
  menu.addEventListener("click", () => {
    const open = menu.getAttribute("aria-expanded") !== "true";
    menu.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    $("#navigation").classList.toggle("open", open);
  });
  $("#navigation")
    .querySelectorAll("a")
    .forEach((link) =>
      link.addEventListener("click", () => {
        $("#navigation").classList.remove("open");
        menu.setAttribute("aria-expanded", "false");
        menu.setAttribute("aria-label", "Abrir menu");
      }),
    );
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.getAttribute("aria-expanded") === "true") {
      $("#navigation").classList.remove("open");
      menu.setAttribute("aria-expanded", "false");
      menu.setAttribute("aria-label", "Abrir menu");
      menu.focus();
    }
  });

}
