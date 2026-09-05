import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const url = process.env.SPRITE_EDITOR_URL ?? 'http://127.0.0.1:5198/sprite-editor/';
const screenshotPath = process.env.SPRITE_EDITOR_SCREENSHOT;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(10000);
const failures = [];
const remoteRequests = [];
page.on('pageerror', (error) => failures.push(`page error: ${error.message}`));
page.on('request', (request) => {
  if (!/^(file|data|blob):/.test(request.url())) remoteRequests.push(request.url());
});
page.on('console', (message) => {
  if (message.type() === 'error') failures.push(`console error: ${message.text()}`);
});

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  console.log('browser smoke: resources loaded');
  await page.selectOption('#exampleSelect', 'bolt');
  await page.waitForTimeout(200);
  console.log('browser smoke: bundled selection state', await page.evaluate(() => ({
    title: document.querySelector('#spriteTitle')?.textContent,
    toast: document.querySelector('#toast')?.textContent,
  })), failures);
  await page.waitForFunction(() => document.querySelector('#spriteTitle')?.textContent === 'bolt');
  await page.waitForFunction(() => document.querySelector('#validationPill')?.textContent === 'Valid Sprite v2');
  console.log('browser smoke: bundled tower loaded');

  const canvasSize = await page.locator('#spriteCanvas').evaluate((canvas) => [canvas.width, canvas.height]);
  assert.deepEqual(canvasSize, [400, 400]);
  assert.equal(await page.locator('#glyphCount').textContent(), '376 / 376');
  assert.equal(await page.locator('#stateList .state-item').count(), 15);

  await page.click('#compareButton');
  assert.equal(await page.locator('#compareDock').evaluate((element) => element.classList.contains('hidden')), false);
  assert.notEqual(
    await page.locator('#previousFrameCanvas').evaluate((canvas) => canvas.toDataURL()),
    await page.locator('#currentFrameCanvas').evaluate((canvas) => canvas.toDataURL()),
    'frame comparison previews should expose animation differences',
  );
  const playingBase = await page.locator('#spriteCanvas').evaluate((canvas) => canvas.toDataURL());
  await page.click('#playButton');
  await page.waitForTimeout(780);
  const playingNext = await page.locator('#spriteCanvas').evaluate((canvas) => canvas.toDataURL());
  assert.notEqual(playingNext, playingBase, 'Play should animate the canvas');
  await page.click('#playButton');
  await page.selectOption('#frameSelect', '0');
  await page.locator('#spriteCanvas').click({ button: 'right', position: { x: 75, y: 40 } });
  assert.match(await page.locator('#toast').textContent(), /^Picked /);
  assert.equal(await page.locator('#selectedGlyphCharacter').textContent(), '.');
  console.log('browser smoke: compare, playback, and eyedropper checked');

  const basePixels = await page.locator('#spriteCanvas').evaluate((canvas) => canvas.toDataURL());
  await page.selectOption('#frameSelect', '1');
  const framePixels = await page.locator('#spriteCanvas').evaluate((canvas) => canvas.toDataURL());
  assert.notEqual(framePixels, basePixels, 'animation frame should change rendered pixels');

  await page.selectOption('#frameSelect', '0');
  await page.locator('#spriteCanvas').click({ position: { x: 24, y: 38 } });
  const paintedPixels = await page.locator('#spriteCanvas').evaluate((canvas) => canvas.toDataURL());
  assert.notEqual(paintedPixels, basePixels, 'painting should change rendered pixels');
  await page.click('#undoButton');
  const undonePixels = await page.locator('#spriteCanvas').evaluate((canvas) => canvas.toDataURL());
  assert.equal(undonePixels, basePixels, 'undo should restore exact rendered pixels');
  console.log('browser smoke: paint and undo checked');

  await page.fill('#colourHexInput', '#3366cc');
  await page.locator('#colourHexInput').press('Enter');
  await page.click('#colourSlotB');
  await page.fill('#colourHexInput', '#cc6633');
  await page.locator('#colourHexInput').press('Enter');
  await page.selectOption('#brushModeSelect', 'linear');
  await page.click('[data-tool="brush"]');
  await page.locator('#spriteCanvas').click({ position: { x: 175, y: 120 } });
  assert.ok(await page.locator('#foregroundSelect option[value*=".custom."]').count() >= 3);
  const beforeWheel = await page.locator('#colourHexInput').inputValue();
  await page.locator('#colourWheel').click({ position: { x: 175, y: 110 } });
  assert.notEqual(await page.locator('#colourHexInput').inputValue(), beforeWheel);
  await page.selectOption('#brushModeSelect', 'radial');
  await page.locator('#spriteCanvas').click({ position: { x: 225, y: 200 } });
  assert.equal(await page.locator('#palettePatchButton').evaluate((element) => element.classList.contains('hidden')), false);
  await page.waitForFunction(() => document.querySelector('#validationPill')?.textContent === 'Valid Sprite v2');
  const patchDownloadPromise = page.waitForEvent('download');
  await page.click('#palettePatchButton');
  assert.equal((await patchDownloadPromise).suggestedFilename(), 'bolt.palette-patch.json');
  console.log('browser smoke: colour wheel role and large brush checked');

  await page.selectOption('#viewMode', 'tile');
  assert.deepEqual(await page.locator('#spriteCanvas').evaluate((canvas) => [canvas.width, canvas.height]), [1200, 1200]);
  const tiledWithoutLayer = await page.locator('#spriteCanvas').evaluate((canvas) => canvas.toDataURL());
  await page.selectOption('#viewMode', 'composite');
  await page.selectOption('#companionExampleSelect', 'road_muted_cobble');
  await page.waitForFunction(() => document.querySelector('#companionLabel')?.textContent === 'road_muted_cobble');
  assert.equal(await page.locator('#companionStateSelect option').count(), 12);
  assert.notEqual(
    await page.locator('#spriteCanvas').evaluate((canvas) => canvas.toDataURL()),
    tiledWithoutLayer,
    'composite underlay should change rendered pixels',
  );
  await page.selectOption('#viewMode', 'edit');
  console.log('browser smoke: tiled and composite previews checked');

  await page.selectOption('#exampleSelect', 'road_muted_cobble');
  await page.waitForFunction(() => document.querySelector('#spriteTitle')?.textContent === 'road_muted_cobble');
  assert.equal(await page.locator('#stateList .state-item').first().locator('span').first().textContent(), '|');
  assert.equal(await page.locator('#variationSelect option').count(), 4);
  const roadBase = await page.locator('#spriteCanvas').evaluate((canvas) => canvas.toDataURL());
  await page.click('#nextVariationButton');
  const roadVariation = await page.locator('#spriteCanvas').evaluate((canvas) => canvas.toDataURL());
  assert.notEqual(roadVariation, roadBase, 'road version navigation should change rendered pixels');
  console.log('browser smoke: version navigation checked');

  const towerStudyPath = new URL('../sources/sprites/ascii-defense-bolt-upgrade-tree-12.json', import.meta.url);
  await page.locator('#fileInput').setInputFiles(fileURLToPath(towerStudyPath));
  await page.waitForFunction(() => document.querySelector('#spriteTitle')?.textContent === 'bolt');
  await page.waitForFunction(() => document.querySelector('#validationPill')?.textContent === 'Valid Sprite v2');
  console.log('browser smoke: tower study converted');

  const roadStudyPath = new URL('../sources/sprites/ascii-defense-complete-road-sprites-31.json', import.meta.url);
  await page.locator('#fileInput').setInputFiles(fileURLToPath(roadStudyPath));
  await page.waitForTimeout(300);
  console.log('browser smoke: road study state', await page.evaluate(() => ({
    title: document.querySelector('#spriteTitle')?.textContent,
    validation: document.querySelector('#validationPill')?.textContent,
    toast: document.querySelector('#toast')?.textContent,
  })));
  await page.waitForFunction(() => document.querySelector('#spriteTitle')?.textContent === 'road_muted_cobble');
  await page.waitForFunction(() => document.querySelector('#validationPill')?.textContent === 'Valid Sprite v2');
  console.log('browser smoke: road study converted');

  const downloadPromise = page.waitForEvent('download');
  await page.click('#saveButton');
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'road_muted_cobble.json');

  await page.selectOption('#exampleSelect', 'frost');
  await page.waitForFunction(() => document.querySelector('#spriteTitle')?.textContent === 'frost');
  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
  assert.deepEqual(failures, []);
  if (url.startsWith('file:')) assert.deepEqual(remoteRequests, [], 'offline build must make no remote requests');
  console.log('sprite-editor browser smoke: all checks passed');
} finally {
  await browser.close();
}
