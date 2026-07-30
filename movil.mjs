import { chromium } from "playwright";
const URL = "http://localhost:5199/PlanincitoBasico/";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const p = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
await p.goto(URL, { waitUntil: "domcontentloaded" });
await p.getByLabel("Tu alias").fill("Ana");
await p.getByRole("button", { name: "Crear sala" }).click();
await p.waitForSelector(".table__surface", { timeout: 20000 });
await p.waitForTimeout(600);
const m = await p.evaluate(() => {
  const r = (s) => document.querySelector(s).getBoundingClientRect();
  const mesa = r(".table"), h = r(".room-header"), d = r(".dock");
  return { arriba: Math.round(mesa.top - h.bottom), abajo: Math.round(d.top - mesa.bottom), scroll: document.documentElement.scrollHeight > window.innerHeight };
});
console.log(`móvil: arriba=${m.arriba}px abajo=${m.abajo}px → ${Math.abs(m.arriba-m.abajo) < 24 ? "centrado" : "DESCENTRADO"}`);
console.log("¿hay scroll vertical innecesario?:", m.scroll ? "sí" : "no");
await p.screenshot({ path: "O-movil.png" });
await browser.close();
