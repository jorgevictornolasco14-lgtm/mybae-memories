import { api } from "../api.js";
import { $, todayKey } from "../components/ui.js";
import { validatePreferences } from "../utils/validators.js";
export function initPlanner(setItinerary) {
  $("#planner-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!event.target.reportValidity()) return;
    if (event.target.getAttribute("aria-busy") === "true") return;
    const button = event.target.querySelector('button[type="submit"]'),
      status = $("#planner-status");
    button.disabled = true;
    event.target.setAttribute("aria-busy", "true");
    button.textContent = "Imaginando um dia só nosso…";
    status.textContent =
      "Criando sugestões para vocês. Pode levar alguns instantes.";
    status.classList.remove("error");
    try {
      const data = await api("ai", {
        method: "POST",
        // The validator returns only the fields collected by this planner.
        body: validatePreferences(Object.fromEntries(new FormData(event.target)), todayKey()),
        errorMessages: {
          400: "Não foi possível gerar o roteiro com essas opções. Seus dados continuam no formulário.",
        },
      });
      setItinerary(data);
      status.textContent = "Nosso roteiro está pronto. Vamos descobrir?";
      $("#roteiros").scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("error");
    } finally {
      event.target.setAttribute("aria-busy", "false");
      button.disabled = false;
      button.textContent = "Criar nosso passeio ♡";
    }
  });
}
