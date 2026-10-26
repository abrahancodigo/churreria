import React from "react";
import { createRoot } from "react-dom/client";
import "./sim.js"; // publica los dobles de Firebase antes de cargar la app
import App from "/src/App.jsx";
import "/src/index.css";

// ---------------------------------------------------------------------------
// ARNÉS DE VERIFICACIÓN VISUAL (solo desarrollo, no entra en el build).
//
// Monta la app real con Firebase simulado para revisar cada pantalla con datos
// de ejemplo sin tocar el proyecto en la nube. Se sirve con:
//   npx vite --config tools/vite.harness.config.js
// Parámetros: ?role=admin|cashier  y  ?p=/inventory (ruta interna a montar).
// Capturas: node tools/shoot.mjs
// ---------------------------------------------------------------------------

const params = new URLSearchParams(location.search);
const desiredRole = params.get("role");
if (desiredRole && globalThis.__FIREBASE_SIM__) {
    globalThis.__FIREBASE_SIM__.profile.role = desiredRole;
}

// La app usa BrowserRouter: la ruta se fija antes de montar para que caiga en
// la pantalla pedida (si no, vería /tools/harness/index.html).
const route = params.get("p") || "/";
window.history.replaceState({}, "", route);

createRoot(document.getElementById("root")).render(<App />);
