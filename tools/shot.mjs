// Herramienta de verificación VISUAL (no forma parte de la app).
// Captura pantallas reales con Chrome headless: sirve para rutas del preview local
// (file: dist/index.html) y para páginas individuales (file: .../pagina.html).
//
// Uso: node tools/shot.mjs <destino> [ancho] [alto] [salida.png]
//   <destino> puede ser "file:C:/ruta/dist/index.html" o una ruta relativa a dist/.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CHROME = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find((p) => fs.existsSync(p));

const [, , dest = "dist/index.html", w = "1440", h = "900", out = "tmp-shots/shot.png"] = process.argv;
const width = Number(w);
const height = Number(h);

if (!CHROME) {
    console.error("No se encontró Chrome ni Edge.");
    process.exit(1);
}

const url = /^(file|https?):/i.test(dest)
    ? dest
    : "file:///" + path.resolve(dest).replace(/\\/g, "/");

const profile = path.resolve(".tmp/chrome-profile-" + process.pid);
fs.mkdirSync(profile, { recursive: true });
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });

const child = spawn(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--window-size=${width},${height}`,
    `--user-data-dir=${profile}`,
    `--screenshot=${path.resolve(out)}`,
    "--virtual-time-budget=6000",
    url,
], { stdio: "ignore", windowsHide: true });

child.on("exit", (code) => {
    fs.rmSync(profile, { recursive: true, force: true });
    const ok = fs.existsSync(out);
    console.log(`${ok ? "OK" : "SIN CAPTURA"} ${out} ${width}x${height} exit=${code}`);
    process.exit(ok ? 0 : 1);
});
