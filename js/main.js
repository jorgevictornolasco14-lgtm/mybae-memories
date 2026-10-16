import { initMemories } from "./features/memories.js";
import { initNavbar } from "./components/navbar.js";
import { $, todayKey } from "./components/ui.js";
import { initGallery } from "./features/gallery.js";
import { initCalendar } from "./features/calendar.js";
import { initItinerary } from "./features/itinerary.js";
import { initAnimations } from "./components/animations.js";
import { initSettings } from "./features/settings.js";
initNavbar();
$('#planner-form [name="data"]').min = todayKey();
const itineraries = initItinerary();
initAnimations();
await Promise.allSettled([
  initGallery(),
  initCalendar((id) => itineraries.showForEvent(id)),
  initMemories(),
  initSettings(),
]);
