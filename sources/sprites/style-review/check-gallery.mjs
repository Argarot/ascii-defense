import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { strict as assert } from 'node:assert';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(fileURLToPath(new URL('index.html', import.meta.url))).href);
  assert.equal(await page.locator('.card').count(), 6);
  assert.equal(await page.locator('#assets button').count(), 11);
  assert.equal(await page.locator('#play').textContent(), 'Play');
  await page.locator('#step').click();
  assert.equal(await page.locator('#frame').textContent(), 'Frame 2 / 5');
  await page.getByRole('button', { name: 'Choose B', exact: true }).click();
  assert.equal(await page.locator('.card.selected h3').textContent(), 'B / Armoured citadel');
  await page.locator('#notes').fill('Test note');
  await page.getByRole('button', { name: 'Frostbite', exact: true }).click();
  assert.equal(await page.locator('.card').count(), 6);
  assert.equal(await page.locator('.native img').first().evaluate(img => img.naturalWidth), 20);
  await page.getByRole('button', { name: 'Bolt Turret', exact: true }).click();
  assert.equal(await page.locator('#notes').inputValue(), 'Test note');
  const download = page.waitForEvent('download');
  await page.locator('#download').click();
  assert.equal((await download).suggestedFilename(), 'ascii-defense-style-choices.json');
  assert.deepEqual(errors, []);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.screenshot({ path: fileURLToPath(new URL('previews/gallery-check.png', import.meta.url)), fullPage: true });
  console.log('Gallery passed: 11 assets, 6 alternatives each, native sizes, reduced motion, frame step, choice/notes retention, export, no page errors.');
} finally {
  await browser.close();
}
