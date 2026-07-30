import { expect, test } from "@playwright/test";

/**
 * Un recorrido completo con dos participantes reales. No pretende cubrir cada
 * detalle: comprueba que el camino principal —crear, entrar, votar, revelar—
 * funciona de verdad en un navegador, que es donde aparecieron los fallos que
 * las pruebas de servidor no podían ver.
 */
test("dos personas estiman una historia y revelan", async ({ browser }) => {
  const errores: string[] = [];

  const anfitrion = await browser.newPage();
  anfitrion.on("pageerror", (e) => errores.push(`anfitrión: ${e.message}`));

  await anfitrion.goto("./");
  await anfitrion.getByLabel("Tu alias").fill("Ana");
  await anfitrion.getByRole("button", { name: "Crear sala" }).click();
  await expect(anfitrion.locator(".table__surface")).toBeVisible();

  const codigo = (await anfitrion.locator(".room-header__code strong").textContent())!.trim();
  expect(codigo).toHaveLength(6);

  // El tema se edita en el encabezado, no en una fila propia.
  await anfitrion.locator(".room-header .topic").click();
  await anfitrion.locator('.room-header input[type="text"]').fill("Exportar informe");
  await anfitrion.keyboard.press("Enter");
  await expect(anfitrion.locator(".room-header .topic")).toHaveText("Exportar informe");

  // Segundo participante por el enlace de invitación.
  const invitado = await browser.newPage();
  invitado.on("pageerror", (e) => errores.push(`invitado: ${e.message}`));
  await invitado.goto(`./#/room/${codigo}`);
  await invitado.getByLabel("Tu alias").fill("Bea");
  await invitado.getByRole("button", { name: "Entrar" }).click();
  await expect(invitado.locator(".table__surface")).toBeVisible();
  await expect(anfitrion.locator(".seat")).toHaveCount(2);

  // Votar oculto: el otro ve que votó, no qué votó.
  await invitado.locator(".deck__card", { hasText: /^8$/ }).click();
  await expect(anfitrion.locator(".seat__card--voted")).toHaveCount(1);
  // Nadie ve valores hasta revelar: ninguna carta está volteada.
  await expect(anfitrion.locator(".seat__card--flipped")).toHaveCount(0);

  // Alternar la carta la retira.
  await invitado.locator(".deck__card", { hasText: /^8$/ }).click();
  await expect(anfitrion.locator(".seat__card--voted")).toHaveCount(0);
  await invitado.locator(".deck__card", { hasText: /^8$/ }).click();

  await anfitrion.locator(".deck__card", { hasText: /^8$/ }).click();
  await anfitrion.getByRole("button", { name: "Revelar cartas" }).click();

  // Cuenta atrás sincronizada y volteo.
  await expect(invitado.locator(".table__countdown")).toBeVisible();
  await expect(anfitrion.locator(".seat__card--flipped")).toHaveCount(2, {
    timeout: 10000,
  });

  // Consenso: promedio en la mesa y fuegos artificiales.
  await expect(anfitrion.locator(".table__figures")).toContainText("8");
  await expect(anfitrion.locator("canvas.celebration")).toBeAttached();

  // El historial vive en un panel lateral y lo ven ambos.
  await invitado.getByRole("button", { name: "Historial" }).click();
  await expect(invitado.locator(".history__item")).toHaveCount(1);
  await expect(invitado.locator(".history__topic")).toContainText("Exportar informe");
  await invitado.keyboard.press("Escape");

  // Nueva ronda: se limpian los votos y nadie queda marcado.
  await anfitrion.getByRole("button", { name: "Nueva ronda" }).click();
  await expect(anfitrion.locator(".seat__card--voted")).toHaveCount(0);
  await expect(invitado.locator(".deck__card--selected")).toHaveCount(0);

  expect(errores).toEqual([]);
});

test("la sesión sobrevive a recargar la pestaña", async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("Tu alias").fill("Ana");
  await page.getByRole("button", { name: "Crear sala" }).click();
  await expect(page.locator(".table__surface")).toBeVisible();

  const codigo = (await page.locator(".room-header__code strong").textContent())!.trim();
  await page.locator(".deck__card", { hasText: /^13$/ }).click();
  await expect(page.locator(".deck__card--selected")).toHaveCount(1);

  await page.reload();

  // Mismo asiento, mismo código y misma carta: §5.6 del plan.
  await expect(page.locator(".table__surface")).toBeVisible();
  await expect(page.locator(".room-header__code strong")).toHaveText(codigo);
  await expect(page.locator(".deck__card--selected")).toHaveCount(1);
  await expect(page.getByLabel("Tu alias")).toHaveCount(0);
});

test("un código inexistente no saca al usuario de la portada", async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("Tu alias").fill("Ana");
  await page.locator('input[aria-label="Código de la sala"]').fill("ZZZZZZ");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.locator(".home")).toBeVisible();
  await expect(page.locator(".table__surface")).toHaveCount(0);
});
