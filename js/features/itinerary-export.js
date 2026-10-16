import { $ } from "../components/ui.js";
export function initItineraryExport() {
  async function exportImage(format) {
    const status = $("#export-status"),
      buttons = [$("#export-png"), $("#export-pdf")];
    buttons.forEach((b) => (b.disabled = true));
    status.textContent = "Preparando nosso pôster…";
    let clone, exportHost;
    try {
      if (!window.htmlToImage || (format === "pdf" && !window.jspdf))
        throw new Error("A exportação não carregou. Atualize a página.");
      await document.fonts.ready;
      clone = $("#itinerary-output .itinerary-paper").cloneNode(true);
      clone.classList.add("poster-mode");
      exportHost = document.createElement("div");
      exportHost.style.cssText =
        "position:fixed;left:-12000px;top:0;width:900px;";
      exportHost.setAttribute("aria-hidden", "true");
      clone.style.cssText = "position:relative;width:900px;padding:40px;";
      clone
        .querySelectorAll(".location-controls,.map-section,.step-content>a")
        .forEach((node) => node.remove());
      clone.querySelector(".itinerary-steps").style.gridTemplateColumns =
        "1fr";
      exportHost.append(clone);
      document.body.append(exportHost);
      await Promise.all(
        [...clone.querySelectorAll("img")].map((img) => {
          img.loading = "eager";
          return img.decode();
        }),
      );
      const dataUrl = await window.htmlToImage.toPng(clone, {
        pixelRatio: 1.8,
        backgroundColor: getComputedStyle(clone).backgroundColor,
        cacheBust: false,
        style: {
          position: "relative",
          left: "0",
          top: "0",
          margin: "0",
          transform: "none",
        },
      });
      if (format === "png") {
        const a = document.createElement("a");
        a.download = "nosso-roteiro-my-bae.png";
        a.href = dataUrl;
        a.click();
      } else {
        const img = new Image();
        img.src = dataUrl;
        await img.decode();
        const height = (img.height * 210) / img.width;
        const pdf = new window.jspdf.jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: [210, height],
          compress: true,
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext("2d").drawImage(img, 0, 0);
        pdf.addImage(
          canvas.toDataURL("image/jpeg", 0.94),
          "JPEG",
          0,
          0,
          210,
          height,
        );
        pdf.save("nosso-roteiro-my-bae.pdf");
      }
      status.textContent = "Pôster exportado com carinho.";
    } catch (error) {
      status.textContent = `Não foi possível exportar: ${error.message}`;
    } finally {
      exportHost?.remove();
      buttons.forEach((b) => (b.disabled = false));
    }
  }
  $("#export-png").addEventListener("click", () => exportImage("png"));
  $("#export-pdf").addEventListener("click", () => exportImage("pdf"));
}
