import { api } from "../api.js";
export function bindMaps(container, itinerary) {
  let map;
  let disposed = false;
  const markers = new Map();
  const mapBox = container.querySelector(".route-map"),
    empty = container.querySelector(".map-empty");
  function addMarker(index, location) {
    if (!window.L)
      throw new Error("Não foi possível carregar o mapa. Recarregue a página.");
    empty.hidden = true;
    mapBox.hidden = false;
    if (!map) {
      map = L.map(mapBox, { scrollWheelZoom: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
    }
    if (markers.has(index)) map.removeLayer(markers.get(index));
    const popup = document.createElement("div");
    popup.textContent = `${index + 1}. ${itinerary.etapas[index].nome} — ${location.nome}`;
    markers.set(
      index,
      L.marker([location.latitude, location.longitude], {
        icon: L.divIcon({
          className: "map-pin",
          html: String(index + 1),
          iconSize: [28, 28],
        }),
      })
        .bindPopup(popup)
        .addTo(map),
    );
    map.fitBounds(
      L.featureGroup([...markers.values()])
        .getBounds()
        .pad(0.15),
      { maxZoom: 15 },
    );
    map.invalidateSize();
  }
  container.querySelectorAll(".location-controls").forEach((control) => {
    const index = Number(control.dataset.index),
      button = control.querySelector("button"),
      input = control.querySelector("input"),
      message = control.querySelector(".location-message");
    button.addEventListener("click", async () => {
      if (!input.reportValidity()) return;
      button.disabled = true;
      message.textContent = "Procurando correspondências…";
      control.querySelector("select")?.remove();
      try {
        const results = await api("mapas", {
          method: "POST",
          body: { query: input.value },
        });
        if (disposed) return;
        if (!results.length) {
          message.textContent =
            "Nenhum resultado. Corrija o nome ou acrescente o endereço.";
          return;
        }
        message.textContent =
          "Confira e escolha o local correto para marcar no mapa:";
        const select = document.createElement("select");
        select.setAttribute(
          "aria-label",
          `Confirmar localização de ${itinerary.etapas[index].nome}`,
        );
        select.append(new Option("Selecione uma correspondência", ""));
        results.forEach((row, i) =>
          select.append(new Option(row.nome, String(i))),
        );
        select.addEventListener("change", () => {
          if (select.value === "") return;
          const location = results[Number(select.value)];
          try { addMarker(index, location); }
          catch (error) { message.textContent = error.message; return; }
          control.parentElement.querySelector(".confirmed-address")?.remove();
          const address = document.createElement("p");
          address.className = "confirmed-address";
          address.textContent = `Local selecionado: ${location.nome} `;
          const link = document.createElement("a");
          link.href = `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = "Como chegar ↗";
          address.append(link);
          control.parentElement.append(address);
          message.textContent =
            "Correspondência selecionada no OpenStreetMap. Confirme os detalhes com o estabelecimento.";
        });
        control.append(select);
      } catch (error) {
        message.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
  });
  return () => {
    disposed = true;
    if (map) {
      map.remove();
      map = null;
    }
  };
}
