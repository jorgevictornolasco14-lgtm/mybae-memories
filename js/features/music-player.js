import { $ } from "../components/ui.js";

const VOLUME_KEY = "mybae-music-volume";

export function initMusicPlayer() {
  const audio = $("#background-music");
  const toggle = $("#music-toggle");
  const panel = $("#music-panel");
  const play = $("#music-play");
  const pause = $("#music-pause");
  const manualPlay = $("#music-manual-play");
  const volume = $("#music-volume");
  const mute = $("#music-mute");
  const progress = $("#music-progress");
  const status = $("#music-status");
  let playPending = false;
  let previousVolume = Number(volume.value);

  try {
    const saved = Number(localStorage.getItem(VOLUME_KEY));
    if (localStorage.getItem(VOLUME_KEY) !== null && Number.isFinite(saved)) {
      volume.value = String(Math.max(0, Math.min(1, saved)));
    }
  } catch { /* Preferência indisponível: mantém o volume padrão. */ }
  audio.volume = Number(volume.value);

  function setPanel(open) {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
  }

  function timeLabel(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  }

  function updatePlayback() {
    const playing = !audio.paused && !audio.ended;
    play.disabled = playing || playPending;
    pause.disabled = !playing && !playPending;
    toggle.classList.toggle("is-playing", playing);
    $("#music-elapsed").textContent = timeLabel(audio.currentTime);
    $("#music-duration").textContent = timeLabel(audio.duration);
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      progress.max = String(audio.duration);
      progress.value = String(Math.min(audio.currentTime, audio.duration));
      progress.disabled = false;
    }
  }

  async function startPlayback(manual = false) {
    if (playPending || (!audio.paused && !audio.ended)) return;
    playPending = true;
    status.textContent = "Carregando nossa música…";
    manualPlay.hidden = true;
    updatePlayback();
    try {
      await audio.play();
      status.textContent = "";
    } catch (error) {
      if (error?.name === "NotAllowedError") {
        status.textContent = manual
          ? "O navegador ainda não permitiu a reprodução. Tente tocar novamente."
          : "A reprodução automática foi bloqueada pelo navegador.";
        manualPlay.hidden = false;
        setPanel(true);
      } else if (error?.name !== "AbortError") {
        status.textContent = "Não foi possível reproduzir o arquivo. Confira se nossa-musica.mp3 está disponível.";
      }
    } finally {
      playPending = false;
      updatePlayback();
    }
  }

  toggle.addEventListener("click", () => setPanel(panel.hidden));
  $("#music-close").addEventListener("click", () => setPanel(false));
  play.addEventListener("click", () => startPlayback(true));
  manualPlay.addEventListener("click", () => startPlayback(true));
  pause.addEventListener("click", () => {
    audio.pause();
    status.textContent = "Música pausada.";
  });
  volume.addEventListener("input", () => {
    audio.volume = Number(volume.value);
    if (audio.volume > 0) previousVolume = audio.volume;
    try { localStorage.setItem(VOLUME_KEY, String(audio.volume)); } catch { /* Preferência opcional. */ }
    mute.setAttribute("aria-label", audio.volume === 0 ? "Ativar som" : "Silenciar música");
  });
  mute.addEventListener("click", () => {
    if (audio.volume > 0) {
      previousVolume = audio.volume;
      volume.value = "0";
    } else {
      volume.value = String(previousVolume || 0.35);
    }
    volume.dispatchEvent(new Event("input", { bubbles: true }));
  });
  $("#music-loop").addEventListener("change", (event) => { audio.loop = event.currentTarget.checked; });
  progress.addEventListener("input", () => {
    if (Number.isFinite(audio.duration)) {
      audio.currentTime = Number(progress.value);
      updatePlayback();
    }
  });
  audio.addEventListener("loadedmetadata", updatePlayback);
  audio.addEventListener("timeupdate", updatePlayback);
  audio.addEventListener("play", updatePlayback);
  audio.addEventListener("pause", updatePlayback);
  audio.addEventListener("ended", updatePlayback);
  audio.addEventListener("error", () => {
    status.textContent = "Não foi possível carregar nossa-musica.mp3. Verifique se o arquivo está em assets/audio/.";
    manualPlay.hidden = true;
    toggle.classList.add("has-error");
    toggle.setAttribute("aria-label", "Player de música: arquivo não carregado");
    updatePlayback();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) setPanel(false);
  });

  audio.loop = $("#music-loop").checked;
  mute.setAttribute("aria-label", audio.volume === 0 ? "Ativar som" : "Silenciar música");
  startPlayback(false);
}
