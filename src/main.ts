import "@/styles/global.css";
import "@/styles/globe.css";
import "@/styles/space.css";
import "@/styles/map.css";
import "@/styles/auth.css";
import "@/styles/dialog.css";

import { App } from "@/app";

const root = document.getElementById("app");
if (!root) throw new Error("#app root element not found");

new App(root).init().catch((err) => {
  console.error("Failed to start MyFootprints:", err);
  root.innerHTML = `<p style="color:#e5e7eb;padding:2rem;font-family:system-ui">
    Something went wrong loading the map. Please reload.</p>`;
});
