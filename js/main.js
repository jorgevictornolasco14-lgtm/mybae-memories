import { initMemories, initMemoryCreate } from "./features/memories.js";
import { initNavbar } from "./components/navbar.js";
import { $, todayKey } from "./components/ui.js";
import { initGallery } from "./features/gallery.js";
import { initGalleryUpload } from "./features/gallery-upload.js";
import { initCalendar } from "./features/calendar.js";
import { initItinerary } from "./features/itinerary.js";
import { initAnimations } from "./components/animations.js";
import { initSettings } from "./features/settings.js";
import { initMusicPlayer } from "./features/music-player.js";
import { initManualItinerary } from "./features/manual-itinerary.js";
import { initAdminDeletion } from "./features/admin-delete.js";
initNavbar();
initMusicPlayer();
const adminDeletion = initAdminDeletion();
$('#planner-form [name="data"]').min = todayKey();
const itineraries = initItinerary();
initManualItinerary(itineraries.setItinerary);
initAnimations();
const galleryReady = initGallery(adminDeletion);
initGalleryUpload(async () => (await galleryReady)());
const refreshMemories = initMemories(adminDeletion);
initMemoryCreate(refreshMemories);
await Promise.allSettled([
  galleryReady,
  initCalendar((id) => itineraries.showForEvent(id)),
  refreshMemories(),
  initSettings(),
]);
