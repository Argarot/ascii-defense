import {
  cells,
  clone,
  codepointLabel,
  convertDocument,
  detectDocumentKind,
  framesFor,
  inferTowerId,
  keyForRole,
  makeFrame,
  replaceCell,
  roleForKey,
  stateLabel,
  targetFor,
  validateSprite,
} from './core.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const ROAD_STATE_ORDER = ['|', '-', 'L', 'J', 'F', '7', 'T', 'U', 'E', '3', 'X', 'B'];

const ui = {
  newButton: $('#newButton'), openButton: $('#openButton'), saveButton: $('#saveButton'),
  palettePatchButton: $('#palettePatchButton'),
  referenceButton: $('#referenceButton'), exampleSelect: $('#exampleSelect'),
  undoButton: $('#undoButton'), redoButton: $('#redoButton'), fileInput: $('#fileInput'),
  referenceInput: $('#referenceInput'), paletteInput: $('#paletteInput'), glyphsetInput: $('#glyphsetInput'),
  spriteTitle: $('#spriteTitle'), dirtyBadge: $('#dirtyBadge'), dropPrompt: $('#dropPrompt'),
  stateSection: $('#stateSection'), stateList: $('#stateList'), addStateButton: $('#addStateButton'),
  duplicateStateButton: $('#duplicateStateButton'), renameStateButton: $('#renameStateButton'),
  deleteStateButton: $('#deleteStateButton'), variationSelect: $('#variationSelect'),
  previousVariationButton: $('#previousVariationButton'), nextVariationButton: $('#nextVariationButton'),
  addVariationButton: $('#addVariationButton'), deleteVariationButton: $('#deleteVariationButton'),
  versionSummary: $('#versionSummary'), frameSelect: $('#frameSelect'),
  previousFrameButton: $('#previousFrameButton'), nextFrameButton: $('#nextFrameButton'),
  addFrameButton: $('#addFrameButton'), deleteFrameButton: $('#deleteFrameButton'),
  playButton: $('#playButton'), frameMsInput: $('#frameMsInput'), gridCheckbox: $('#gridCheckbox'),
  zoomInput: $('#zoomInput'), zoomLabel: $('#zoomLabel'), canvasShell: $('#canvasShell'),
  canvas: $('#spriteCanvas'), canvasEmpty: $('#canvasEmpty'), cellStatus: $('#cellStatus'),
  viewMode: $('#viewMode'), compareButton: $('#compareButton'), previewToolbar: $('#previewToolbar'),
  tileColsInput: $('#tileColsInput'), tileRowsInput: $('#tileRowsInput'),
  cycleVariationsCheckbox: $('#cycleVariationsCheckbox'), compositeControls: $('#compositeControls'),
  loadCompanionButton: $('#loadCompanionButton'), companionExampleSelect: $('#companionExampleSelect'),
  companionStateSelect: $('#companionStateSelect'), companionVariationSelect: $('#companionVariationSelect'),
  companionLayerSelect: $('#companionLayerSelect'), clearCompanionButton: $('#clearCompanionButton'),
  companionLabel: $('#companionLabel'), companionInput: $('#companionInput'),
  compareDock: $('#compareDock'), previousFrameCanvas: $('#previousFrameCanvas'),
  currentFrameCanvas: $('#currentFrameCanvas'), nextFrameCanvas: $('#nextFrameCanvas'),
  selectionStatus: $('#selectionStatus'), validateButton: $('#validateButton'),
  validationPill: $('#validationPill'), validationPanel: $('#validationPanel'),
  applyGlyph: $('#applyGlyph'), applyForeground: $('#applyForeground'),
  applyBackground: $('#applyBackground'), foregroundSelect: $('#foregroundSelect'),
  backgroundSelect: $('#backgroundSelect'), foregroundSwatch: $('#foregroundSwatch'),
  backgroundSwatch: $('#backgroundSwatch'), foregroundKey: $('#foregroundKey'),
  backgroundKey: $('#backgroundKey'), glyphSearch: $('#glyphSearch'), glyphRange: $('#glyphRange'),
  glyphCanvas: $('#glyphCanvas'), glyphCount: $('#glyphCount'), selectedGlyphCanvas: $('#selectedGlyphCanvas'),
  selectedGlyphCharacter: $('#selectedGlyphCharacter'), selectedGlyphCode: $('#selectedGlyphCode'),
  loadPaletteButton: $('#loadPaletteButton'), loadGlyphsetButton: $('#loadGlyphsetButton'),
  colourSlotA: $('#colourSlotA'), colourSlotB: $('#colourSlotB'), colourHexInput: $('#colourHexInput'),
  colourWheel: $('#colourWheel'), colourValueInput: $('#colourValueInput'),
  colourValueLabel: $('#colourValueLabel'), useForegroundButton: $('#useForegroundButton'),
  useBackgroundButton: $('#useBackgroundButton'), brushSizeInput: $('#brushSizeInput'),
  brushSizeLabel: $('#brushSizeLabel'), brushShapeSelect: $('#brushShapeSelect'),
  brushModeSelect: $('#brushModeSelect'), brushDirectionSelect: $('#brushDirectionSelect'),
  toast: $('#toast'),
};

const app = {
  sprite: null,
  filename: '',
  palette: { roles: {} },
  contentGrid: null,
  glyphset: null,
  glyphBytes: null,
  glyphIndex: new Map(),
  stateKey: '',
  variationIndex: 0,
  frameIndex: 0,
  glyphCodepoint: 0x23,
  foregroundRole: 'PATH',
  backgroundRole: null,
  tool: 'pencil',
  viewMode: 'edit',
  zoom: 10,
  grid: true,
  undo: [],
  redo: [],
  dirty: false,
  painting: false,
  lastPaintCell: null,
  hoverCell: null,
  dragStart: null,
  dragEnd: null,
  selection: null,
  clipboard: null,
  playing: false,
  playTimer: null,
  pendingStudy: null,
  glyphLayout: [],
  validationTimer: null,
  compareFrames: false,
  tileCols: 3,
  tileRows: 3,
  companion: null,
  companionFilename: '',
  companionStateKey: '',
  companionVariationIndex: 0,
  companionLayer: 'under',
  colourSlot: 0,
  colours: ['#d8e1eb', '#10151d'],
  colourHsv: [{ h: 210, s: 0.08, v: 0.89 }, { h: 214, s: 0.41, v: 0.11 }],
  brushSize: 3,
  brushShape: 'circle',
  brushMode: 'solid',
  brushDirection: 'horizontal',
  customRoles: new Set(),
};

function toast(message, duration = 2600) {
  ui.toast.textContent = message;
  ui.toast.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ui.toast.classList.add('hidden'), duration);
}

function roleColour(role) {
  if (role === null || role === undefined) return null;
  if (role === 'PATH') return app.palette.roles['path.1'] ?? '#4cc9f0';
  if (app.palette.roles[role]) return app.palette.roles[role];
  let hash = 0;
  for (const char of role) hash = ((hash << 5) - hash + char.codePointAt(0)) | 0;
  return `hsl(${Math.abs(hash) % 360} 45% 60%)`;
}

function clamp(value, low = 0, high = 1) {
  return Math.max(low, Math.min(high, value));
}

function hsvToRgb({ h, s, v }) {
  const hue = ((h % 360) + 360) % 360;
  const chroma = v * s;
  const section = hue / 60;
  const second = chroma * (1 - Math.abs((section % 2) - 1));
  const choices = section < 1 ? [chroma, second, 0]
    : section < 2 ? [second, chroma, 0]
      : section < 3 ? [0, chroma, second]
        : section < 4 ? [0, second, chroma]
          : section < 5 ? [second, 0, chroma]
            : [chroma, 0, second];
  const match = v - chroma;
  return choices.map((channel) => Math.round((channel + match) * 255));
}

function rgbToHsv([rByte, gByte, bByte]) {
  const r = rByte / 255;
  const g = gByte / 255;
  const b = bByte / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  return { h: (h + 360) % 360, s: max ? delta / max : 0, v: max };
}

function hexToRgb(hex) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!match) return null;
  return [0, 2, 4].map((offset) => parseInt(match[1].slice(offset, offset + 2), 16));
}

function rgbToHex(rgb) {
  return `#${rgb.map((channel) => Math.round(clamp(channel, 0, 255)).toString(16).padStart(2, '0')).join('')}`;
}

function mixHex(first, second, amount) {
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  return rgbToHex(a.map((channel, index) => channel + (b[index] - channel) * clamp(amount)));
}

function activeColour() {
  return app.colours[app.colourSlot];
}

function setActiveColour(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const normalized = rgbToHex(rgb);
  app.colours[app.colourSlot] = normalized;
  app.colourHsv[app.colourSlot] = rgbToHsv(rgb);
  renderColourLab();
  return true;
}

function ensureCustomRole(hex) {
  if (!app.sprite) return null;
  const normalized = rgbToHex(hexToRgb(hex));
  const role = `sprite.${app.sprite.id}.custom.${normalized.slice(1)}`;
  app.palette.roles[role] = normalized;
  app.customRoles.add(role);
  return role;
}

function customRolesUsed() {
  if (!app.sprite) return [];
  const prefix = `sprite.${app.sprite.id}.custom.`;
  return [...new Set(Object.values(app.sprite.inkMap))]
    .filter((role) => typeof role === 'string' && role.startsWith(prefix) && app.palette.roles[role]);
}

function renderColourWheel() {
  const canvas = ui.colourWheel;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(canvas.width, canvas.height);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = Math.min(cx, cy) - 3;
  const value = app.colourHsv[app.colourSlot].v;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const saturation = Math.sqrt(dx * dx + dy * dy) / radius;
      const offset = (y * canvas.width + x) * 4;
      if (saturation > 1) {
        image.data[offset + 3] = 0;
        continue;
      }
      const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      const [r, g, b] = hsvToRgb({ h: hue, s: saturation, v: value });
      image.data[offset] = r;
      image.data[offset + 1] = g;
      image.data[offset + 2] = b;
      image.data[offset + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const hsv = app.colourHsv[app.colourSlot];
  const angle = hsv.h * Math.PI / 180;
  const markerX = cx + Math.cos(angle) * hsv.s * radius;
  const markerY = cy + Math.sin(angle) * hsv.s * radius;
  ctx.strokeStyle = hsv.v > 0.55 ? '#000000' : '#ffffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(markerX, markerY, 6, 0, Math.PI * 2);
  ctx.stroke();
}

function renderColourLab() {
  [ui.colourSlotA, ui.colourSlotB].forEach((button, index) => {
    button.classList.toggle('active', app.colourSlot === index);
    button.querySelector('span').style.background = app.colours[index];
  });
  ui.colourHexInput.value = activeColour().toUpperCase();
  ui.colourValueInput.value = String(Math.round(app.colourHsv[app.colourSlot].v * 100));
  ui.colourValueLabel.textContent = `${ui.colourValueInput.value}%`;
  ui.brushSizeInput.value = String(app.brushSize);
  ui.brushSizeLabel.textContent = String(app.brushSize);
  ui.brushShapeSelect.value = app.brushShape;
  ui.brushModeSelect.value = app.brushMode;
  ui.brushDirectionSelect.value = app.brushDirection;
  renderColourWheel();
}

function decodeGlyphset(glyphset) {
  if (!glyphset?.cell || !Array.isArray(glyphset.codepoints) || typeof glyphset.bits !== 'string') {
    throw new Error('Invalid glyphset JSON');
  }
  const binary = atob(glyphset.bits);
  const expected = glyphset.codepoints.length * glyphset.cell[1];
  if (binary.length !== expected) throw new Error(`Glyphset has ${binary.length} bitmap bytes; expected ${expected}`);
  app.glyphset = glyphset;
  app.glyphBytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  app.glyphIndex = new Map(glyphset.codepoints.map((cp, index) => [cp, index]));
  if (!app.glyphIndex.has(app.glyphCodepoint)) app.glyphCodepoint = glyphset.codepoints[0];
  renderGlyphBrowser();
  renderSelectedGlyph();
  renderCanvas();
}

function drawGlyph(ctx, codepoint, x, y, scale, colour = '#ffffff') {
  if (!app.glyphset || !app.glyphBytes) return false;
  const slot = app.glyphIndex.get(codepoint);
  if (slot === undefined) return false;
  const [width, height] = app.glyphset.cell;
  ctx.fillStyle = colour;
  for (let row = 0; row < height; row++) {
    const byte = app.glyphBytes[slot * height + row];
    for (let col = 0; col < width; col++) {
      if ((byte >> (7 - col)) & 1) ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
    }
  }
  return true;
}

function sortedSpriteStateKeys(sprite) {
  if (!sprite) return [];
  const keys = Object.keys(sprite.states);
  if (ROAD_STATE_ORDER.every((key) => keys.includes(key))) {
    const roadKeys = ROAD_STATE_ORDER.filter((key) => keys.includes(key));
    return [...roadKeys, ...keys.filter((key) => !ROAD_STATE_ORDER.includes(key))];
  }
  return keys.sort((a, b) => {
    if (a === '') return -1;
    if (b === '') return 1;
    return a.length - b.length || a.localeCompare(b, undefined, { numeric: true });
  });
}

function sortedStateKeys() {
  return sortedSpriteStateKeys(app.sprite);
}

function currentState() {
  return app.sprite?.states[app.stateKey] ?? null;
}

function currentBody() {
  const state = currentState();
  if (!state) return null;
  return app.variationIndex === 0 ? state : state.variations?.[app.variationIndex - 1] ?? null;
}

function currentTarget() {
  return app.sprite ? targetFor(app.sprite, app.stateKey, app.variationIndex, app.frameIndex) : null;
}

function clampNavigation() {
  if (!app.sprite) return;
  if (!app.sprite.states[app.stateKey]) app.stateKey = sortedStateKeys()[0] ?? '';
  const variations = currentState()?.variations?.length ?? 0;
  app.variationIndex = Math.max(0, Math.min(app.variationIndex, variations));
  const frames = framesFor(currentState(), app.variationIndex);
  app.frameIndex = Math.max(0, Math.min(app.frameIndex, Math.max(0, frames.length - 1)));
}

function setSprite(sprite, filename) {
  stopPlayback();
  app.sprite = sprite;
  app.filename = filename || `${sprite.id}.json`;
  app.stateKey = Object.prototype.hasOwnProperty.call(sprite.states, '') ? '' : sortedStateKeys()[0];
  app.variationIndex = 0;
  app.frameIndex = 0;
  app.undo = [];
  app.redo = [];
  app.dirty = false;
  app.selection = null;
  app.hoverCell = null;
  const target = currentTarget();
  let foregroundRole = null;
  let backgroundRole = null;
  if (target) {
    for (let y = 0; y < sprite.cell[1] && !foregroundRole; y++) {
      for (let x = 0; x < sprite.cell[0] && !foregroundRole; x++) {
        if (cells(target.art[y])[x] === ' ') continue;
        const foreground = roleForKey(sprite, cells(target.ink[y])[x]);
        if (typeof foreground === 'string') foregroundRole = foreground;
        const background = roleForKey(sprite, cells(target.bgInk?.[y] ?? '.'.repeat(sprite.cell[0]))[x]);
        if (typeof background === 'string') backgroundRole = background;
      }
    }
  }
  app.foregroundRole = foregroundRole ?? Object.values(sprite.inkMap).find((role) => typeof role === 'string') ?? 'PATH';
  app.backgroundRole = backgroundRole;
  renderAll();
  runValidation(false);
}

function historySnapshot() {
  if (!app.sprite) return;
  app.undo.push(JSON.stringify(app.sprite));
  if (app.undo.length > 200) app.undo.shift();
  app.redo = [];
  app.dirty = true;
  updateHistoryButtons();
}

function restoreSnapshot(serialized, destination) {
  if (!app.sprite) return;
  destination.push(JSON.stringify(app.sprite));
  app.sprite = JSON.parse(serialized);
  clampNavigation();
  app.dirty = true;
  renderAll();
}

function undo() {
  const snapshot = app.undo.pop();
  if (snapshot) restoreSnapshot(snapshot, app.redo);
}

function redo() {
  const snapshot = app.redo.pop();
  if (snapshot) restoreSnapshot(snapshot, app.undo);
}

function updateHistoryButtons() {
  ui.undoButton.disabled = !app.undo.length;
  ui.redoButton.disabled = !app.redo.length;
  ui.dirtyBadge.classList.toggle('hidden', !app.dirty);
}

function markChanged(full = false) {
  app.dirty = true;
  updateHistoryButtons();
  if (full) renderAll();
  else {
    renderCanvas();
    scheduleValidation();
  }
}

function scheduleValidation() {
  clearTimeout(app.validationTimer);
  app.validationTimer = setTimeout(() => runValidation(false), 180);
}

function renderAll() {
  const hasSprite = Boolean(app.sprite);
  ui.spriteTitle.textContent = hasSprite ? app.sprite.id : 'No sprite open';
  ui.dropPrompt.classList.toggle('hidden', hasSprite);
  ui.stateSection.classList.toggle('hidden', !hasSprite);
  ui.canvasEmpty.classList.toggle('hidden', hasSprite);
  ui.canvasShell.classList.toggle('empty', !hasSprite);
  ui.saveButton.disabled = !hasSprite;
  ui.validateButton.disabled = !hasSprite;
  updateHistoryButtons();
  renderStateList();
  renderTimeline();
  renderPreviewControls();
  renderRoleControls();
  renderColourLab();
  renderCanvas();
  renderGlyphBrowser();
  renderSelectedGlyph();
  scheduleValidation();
}

function renderPreviewControls() {
  const previewing = app.viewMode !== 'edit';
  ui.viewMode.value = app.viewMode;
  ui.previewToolbar.classList.toggle('hidden', !previewing);
  ui.compositeControls.classList.toggle('hidden', app.viewMode !== 'composite');
  ui.tileColsInput.value = String(app.tileCols);
  ui.tileRowsInput.value = String(app.tileRows);
  ui.companionLabel.textContent = app.companion ? app.companion.id : 'No layer loaded';
  ui.companionStateSelect.replaceChildren();
  ui.companionVariationSelect.replaceChildren();
  if (app.companion) {
    for (const key of sortedSpriteStateKeys(app.companion)) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = stateLabel(key);
      ui.companionStateSelect.append(option);
    }
    if (!app.companion.states[app.companionStateKey]) app.companionStateKey = sortedSpriteStateKeys(app.companion)[0];
    ui.companionStateSelect.value = app.companionStateKey;
    const state = app.companion.states[app.companionStateKey];
    const count = 1 + (state.variations?.length ?? 0);
    for (let index = 0; index < count; index++) {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = index === 0 ? 'Version 0' : `Version ${index}`;
      ui.companionVariationSelect.append(option);
    }
    app.companionVariationIndex = Math.min(app.companionVariationIndex, count - 1);
    ui.companionVariationSelect.value = String(app.companionVariationIndex);
  }
  ui.companionStateSelect.disabled = !app.companion;
  ui.companionVariationSelect.disabled = !app.companion;
  ui.companionLayerSelect.value = app.companionLayer;
  ui.clearCompanionButton.disabled = !app.companion;
  ui.palettePatchButton.classList.toggle('hidden', customRolesUsed().length === 0);
}

function renderStateList() {
  ui.stateList.replaceChildren();
  if (!app.sprite) return;
  for (const key of sortedStateKeys()) {
    const state = app.sprite.states[key];
    const button = document.createElement('button');
    button.className = `state-item${key === app.stateKey ? ' active' : ''}`;
    const name = document.createElement('span');
    name.textContent = stateLabel(key);
    const counts = document.createElement('span');
    const versionCount = 1 + (state.variations?.length ?? 0);
    const frameCount = 1 + (state.frames?.length ?? 0);
    counts.textContent = `${versionCount}v / ${frameCount}f`;
    button.append(name, counts);
    button.addEventListener('click', () => {
      app.stateKey = key;
      app.variationIndex = 0;
      app.frameIndex = 0;
      app.selection = null;
      renderStateList();
      renderTimeline();
      renderCanvas();
    });
    ui.stateList.append(button);
  }
}

function renderTimeline() {
  const state = currentState();
  ui.variationSelect.replaceChildren();
  ui.frameSelect.replaceChildren();
  if (!state) return;

  const variationCount = 1 + (state.variations?.length ?? 0);
  for (let index = 0; index < variationCount; index++) {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = index === 0 ? 'Version 0 (base)' : `Version ${index}`;
    ui.variationSelect.append(option);
  }
  ui.variationSelect.value = String(app.variationIndex);
  ui.versionSummary.textContent = `${variationCount} total`;
  ui.previousVariationButton.disabled = variationCount < 2;
  ui.nextVariationButton.disabled = variationCount < 2;
  ui.deleteVariationButton.disabled = app.variationIndex === 0;

  const frames = framesFor(state, app.variationIndex);
  frames.forEach((_, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = index === 0 ? 'Frame 0 (base)' : `Frame ${index}`;
    ui.frameSelect.append(option);
  });
  ui.frameSelect.value = String(app.frameIndex);
  ui.previousFrameButton.disabled = frames.length < 2;
  ui.nextFrameButton.disabled = frames.length < 2;
  ui.deleteFrameButton.disabled = app.frameIndex === 0;
  ui.playButton.disabled = frames.length < 2;
  ui.playButton.textContent = app.playing ? 'Stop' : 'Play';
  ui.frameMsInput.value = String(app.sprite.frameMs ?? 720);
}

function paletteRoleNames() {
  const names = new Set(['PATH']);
  Object.values(app.sprite?.inkMap ?? {}).forEach((role) => {
    if (typeof role === 'string') names.add(role);
  });
  Object.keys(app.palette.roles ?? {}).forEach((role) => names.add(role));
  return [...names].sort((a, b) => a.localeCompare(b));
}

function addRoleOptions(select, includeTransparent) {
  select.replaceChildren();
  if (includeTransparent) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Transparent';
    select.append(option);
  }
  for (const role of paletteRoleNames()) {
    const option = document.createElement('option');
    option.value = role;
    option.textContent = role;
    select.append(option);
  }
}

function mappedKeyForRole(role) {
  if (!app.sprite) return '-';
  if (role === null) return '.';
  return Object.entries(app.sprite.inkMap).find(([, mapped]) => mapped === role)?.[0] ?? '+';
}

function renderRoleControls() {
  addRoleOptions(ui.foregroundSelect, false);
  addRoleOptions(ui.backgroundSelect, true);
  if (!paletteRoleNames().includes(app.foregroundRole)) app.foregroundRole = paletteRoleNames()[0] ?? 'PATH';
  ui.foregroundSelect.value = app.foregroundRole;
  ui.backgroundSelect.value = app.backgroundRole ?? '';
  ui.foregroundSwatch.style.background = roleColour(app.foregroundRole);
  ui.backgroundSwatch.classList.toggle('transparent', app.backgroundRole === null);
  ui.backgroundSwatch.style.background = app.backgroundRole === null ? '' : roleColour(app.backgroundRole);
  ui.foregroundKey.textContent = mappedKeyForRole(app.foregroundRole);
  ui.backgroundKey.textContent = mappedKeyForRole(app.backgroundRole);
}

function drawTransparency(ctx, width, height, unit = 12) {
  ctx.fillStyle = '#18212b';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#222d39';
  for (let y = 0; y < height; y += unit) {
    for (let x = 0; x < width; x += unit) {
      if (((x / unit) + (y / unit)) % 2 === 0) ctx.fillRect(x, y, unit, unit);
    }
  }
}

function drawSpriteTarget(ctx, sprite, target, offsetX, offsetY, zoom) {
  if (!sprite || !target || !app.glyphset) return;
  const [glyphWidth, glyphHeight] = app.glyphset.cell;
  const [width, height] = sprite.cell;
  const cellWidth = glyphWidth * zoom;
  const cellHeight = glyphHeight * zoom;
  for (let y = 0; y < height; y++) {
    const art = cells(target.art[y]);
    const ink = cells(target.ink[y]);
    const bg = cells(target.bgInk?.[y] ?? '.'.repeat(width));
    for (let x = 0; x < width; x++) {
      const char = art[x];
      const foregroundRole = roleForKey(sprite, ink[x]);
      if (char === ' ' || foregroundRole === null || foregroundRole === undefined) continue;
      const backgroundRole = roleForKey(sprite, bg[x]);
      const px = offsetX + x * cellWidth;
      const py = offsetY + y * cellHeight;
      ctx.fillStyle = roleColour(backgroundRole) ?? roleColour('tower.ground') ?? '#0c1017';
      ctx.fillRect(px, py, cellWidth, cellHeight);
      const ok = drawGlyph(ctx, char.codePointAt(0), px, py, zoom, roleColour(foregroundRole));
      if (!ok) {
        ctx.strokeStyle = '#ff3b81';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 2, py + 2, cellWidth - 4, cellHeight - 4);
      }
    }
  }
}

function targetForVersion(sprite, stateKey, variationIndex, frameIndex) {
  const state = sprite?.states[stateKey];
  if (!state) return null;
  const versionFrames = framesFor(state, variationIndex);
  return versionFrames[frameIndex % versionFrames.length] ?? versionFrames[0] ?? null;
}

function companionTarget(variationIndex = app.companionVariationIndex) {
  return targetForVersion(app.companion, app.companionStateKey, variationIndex, app.frameIndex);
}

function renderCanvas() {
  const target = currentTarget();
  if (!target || !app.glyphset || !app.sprite) {
    ui.canvas.width = 1;
    ui.canvas.height = 1;
    return;
  }
  const [glyphWidth, glyphHeight] = app.glyphset.cell;
  const [width, height] = app.sprite.cell;
  const cellWidth = glyphWidth * app.zoom;
  const cellHeight = glyphHeight * app.zoom;
  const tileCols = app.viewMode === 'edit' ? 1 : app.tileCols;
  const tileRows = app.viewMode === 'edit' ? 1 : app.tileRows;
  const tilePixelWidth = width * cellWidth;
  const tilePixelHeight = height * cellHeight;
  ui.canvas.width = tileCols * tilePixelWidth;
  ui.canvas.height = tileRows * tilePixelHeight;
  const ctx = ui.canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawTransparency(ctx, ui.canvas.width, ui.canvas.height, app.zoom * 2);

  const state = currentState();
  const variationCount = 1 + (state.variations?.length ?? 0);
  for (let tileY = 0; tileY < tileRows; tileY++) {
    for (let tileX = 0; tileX < tileCols; tileX++) {
      const tileIndex = tileY * tileCols + tileX;
      const variationIndex = app.viewMode !== 'edit' && ui.cycleVariationsCheckbox.checked
        ? tileIndex % variationCount
        : app.variationIndex;
      const activeTarget = targetForVersion(app.sprite, app.stateKey, variationIndex, app.frameIndex);
      const offsetX = tileX * tilePixelWidth;
      const offsetY = tileY * tilePixelHeight;
      const companionState = app.companion?.states[app.companionStateKey];
      const companionVariationCount = 1 + (companionState?.variations?.length ?? 0);
      const companionVariationIndex = ui.cycleVariationsCheckbox.checked
        ? tileIndex % companionVariationCount
        : app.companionVariationIndex;
      const companion = app.viewMode === 'composite' ? companionTarget(companionVariationIndex) : null;
      if (companion && app.companionLayer === 'under') drawSpriteTarget(ctx, app.companion, companion, offsetX, offsetY, app.zoom);
      drawSpriteTarget(ctx, app.sprite, activeTarget, offsetX, offsetY, app.zoom);
      if (companion && app.companionLayer === 'over') drawSpriteTarget(ctx, app.companion, companion, offsetX, offsetY, app.zoom);
    }
  }

  if (app.grid) {
    ctx.strokeStyle = 'rgba(150, 180, 205, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < width * tileCols; x++) {
      ctx.moveTo(x * cellWidth + 0.5, 0);
      ctx.lineTo(x * cellWidth + 0.5, ui.canvas.height);
    }
    for (let y = 1; y < height * tileRows; y++) {
      ctx.moveTo(0, y * cellHeight + 0.5);
      ctx.lineTo(ui.canvas.width, y * cellHeight + 0.5);
    }
    ctx.stroke();
    if (app.viewMode !== 'edit') {
      ctx.strokeStyle = 'rgba(46, 230, 160, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 1; x < tileCols; x++) {
        ctx.moveTo(x * tilePixelWidth, 0);
        ctx.lineTo(x * tilePixelWidth, ui.canvas.height);
      }
      for (let y = 1; y < tileRows; y++) {
        ctx.moveTo(0, y * tilePixelHeight);
        ctx.lineTo(ui.canvas.width, y * tilePixelHeight);
      }
      ctx.stroke();
    }
  }
  if (app.viewMode === 'edit') {
    drawRectOverlay(ctx, app.selection, '#2ee6a0', cellWidth, cellHeight);
    if (app.dragStart && app.dragEnd) {
      drawRectOverlay(ctx, normalizedRect(app.dragStart, app.dragEnd), app.tool === 'rectangle' ? '#ffbd5d' : '#2ee6a0', cellWidth, cellHeight);
    }
  }
  renderFrameCompare();
}

function renderTargetPreview(canvas, target) {
  const ctx = canvas.getContext('2d');
  drawTransparency(ctx, canvas.width, canvas.height, 8);
  if (!target || !app.sprite || !app.glyphset) return;
  const [glyphWidth, glyphHeight] = app.glyphset.cell;
  const scale = Math.max(1, Math.floor(Math.min(canvas.width / (app.sprite.cell[0] * glyphWidth), canvas.height / (app.sprite.cell[1] * glyphHeight))));
  const renderedWidth = app.sprite.cell[0] * glyphWidth * scale;
  const renderedHeight = app.sprite.cell[1] * glyphHeight * scale;
  drawSpriteTarget(ctx, app.sprite, target, Math.floor((canvas.width - renderedWidth) / 2), Math.floor((canvas.height - renderedHeight) / 2), scale);
}

function renderFrameCompare() {
  const frames = currentState() ? framesFor(currentState(), app.variationIndex) : [];
  const show = app.compareFrames && app.viewMode === 'edit' && frames.length > 1;
  ui.compareDock.classList.toggle('hidden', !show);
  ui.compareButton.classList.toggle('active', show);
  if (!show) return;
  const previous = (app.frameIndex - 1 + frames.length) % frames.length;
  const next = (app.frameIndex + 1) % frames.length;
  renderTargetPreview(ui.previousFrameCanvas, frames[previous]);
  renderTargetPreview(ui.currentFrameCanvas, frames[app.frameIndex]);
  renderTargetPreview(ui.nextFrameCanvas, frames[next]);
}

function drawRectOverlay(ctx, rect, colour, cellWidth, cellHeight) {
  if (!rect) return;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(rect.x * cellWidth + 1, rect.y * cellHeight + 1,
    rect.width * cellWidth - 2, rect.height * cellHeight - 2);
  ctx.setLineDash([]);
}

function visibleGlyphCodepoints() {
  if (!app.glyphset) return [];
  const range = ui.glyphRange.value;
  const query = ui.glyphSearch.value.trim();
  let exact = null;
  if (/^U\+[0-9a-f]+$/i.test(query)) exact = parseInt(query.slice(2), 16);
  else if (/^0x[0-9a-f]+$/i.test(query)) exact = parseInt(query.slice(2), 16);
  else if (Array.from(query).length === 1) exact = query.codePointAt(0);
  return app.glyphset.codepoints.filter((cp) => {
    const inRange = range === 'all'
      || (range === 'ascii' && cp >= 0x20 && cp <= 0x7e)
      || (range === 'braille' && cp >= 0x2800 && cp <= 0x28ff)
      || (range === 'box' && cp >= 0x2500 && cp <= 0x257f)
      || (range === 'other' && !((cp >= 0x20 && cp <= 0x7e) || (cp >= 0x2800 && cp <= 0x28ff) || (cp >= 0x2500 && cp <= 0x257f)));
    if (!inRange) return false;
    if (!query) return true;
    if (exact !== null) return cp === exact;
    return codepointLabel(cp).includes(query.toUpperCase());
  });
}

function renderGlyphBrowser() {
  const ctx = ui.glyphCanvas.getContext('2d');
  if (!app.glyphset) {
    ui.glyphCanvas.width = 1;
    ui.glyphCanvas.height = 1;
    ui.glyphCount.textContent = 'No atlas';
    return;
  }
  const tileWidth = 29;
  const tileHeight = 35;
  const availableWidth = Math.max(250, ui.glyphCanvas.parentElement.clientWidth - 2);
  const columns = Math.max(8, Math.floor(availableWidth / tileWidth));
  const codepoints = visibleGlyphCodepoints();
  app.glyphLayout = codepoints;
  ui.glyphCanvas.width = columns * tileWidth;
  ui.glyphCanvas.height = Math.max(tileHeight, Math.ceil(codepoints.length / columns) * tileHeight);
  ctx.fillStyle = '#090d12';
  ctx.fillRect(0, 0, ui.glyphCanvas.width, ui.glyphCanvas.height);
  codepoints.forEach((cp, index) => {
    const x = (index % columns) * tileWidth;
    const y = Math.floor(index / columns) * tileHeight;
    if (cp === app.glyphCodepoint) {
      ctx.fillStyle = '#113c31';
      ctx.fillRect(x, y, tileWidth, tileHeight);
      ctx.strokeStyle = '#2ee6a0';
      ctx.strokeRect(x + 0.5, y + 0.5, tileWidth - 1, tileHeight - 1);
    } else {
      ctx.strokeStyle = '#1f2a36';
      ctx.strokeRect(x + 0.5, y + 0.5, tileWidth - 1, tileHeight - 1);
    }
    const [gw, gh] = app.glyphset.cell;
    const scale = 3;
    drawGlyph(ctx, cp, x + Math.floor((tileWidth - gw * scale) / 2), y + Math.floor((tileHeight - gh * scale) / 2), scale, '#d8e1eb');
  });
  ui.glyphCanvas.dataset.columns = String(columns);
  ui.glyphCount.textContent = `${codepoints.length} / ${app.glyphset.codepoints.length}`;
}

function renderSelectedGlyph() {
  const canvas = ui.selectedGlyphCanvas;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#080b10';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!app.glyphset) return;
  const [width, height] = app.glyphset.cell;
  const scale = Math.max(1, Math.floor(Math.min((canvas.width - 12) / width, (canvas.height - 12) / height)));
  drawGlyph(ctx, app.glyphCodepoint, Math.floor((canvas.width - width * scale) / 2),
    Math.floor((canvas.height - height * scale) / 2), scale, roleColour(app.foregroundRole));
  const char = String.fromCodePoint(app.glyphCodepoint);
  ui.selectedGlyphCharacter.textContent = char === ' ' ? 'SPACE' : char;
  ui.selectedGlyphCode.textContent = `${codepointLabel(app.glyphCodepoint)} / ${app.glyphIndex.get(app.glyphCodepoint)}`;
}

function canvasCell(event) {
  if (!app.sprite || !app.glyphset) return null;
  const rect = ui.canvas.getBoundingClientRect();
  const scaleX = ui.canvas.width / rect.width;
  const scaleY = ui.canvas.height / rect.height;
  const [glyphWidth, glyphHeight] = app.glyphset.cell;
  const x = Math.floor((event.clientX - rect.left) * scaleX / (glyphWidth * app.zoom));
  const y = Math.floor((event.clientY - rect.top) * scaleY / (glyphHeight * app.zoom));
  if (x < 0 || y < 0 || x >= app.sprite.cell[0] || y >= app.sprite.cell[1]) return null;
  return { x, y };
}

function normalizedRect(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.abs(a.x - b.x) + 1, height: Math.abs(a.y - b.y) + 1 };
}

function ensureBackground(target) {
  if (!target.bgInk) target.bgInk = Array.from({ length: app.sprite.cell[1] }, () => '.'.repeat(app.sprite.cell[0]));
}

function applyAt(x, y, tool = app.tool) {
  const target = currentTarget();
  if (!target) return;
  if (tool === 'eraser') {
    ensureBackground(target);
    target.art[y] = replaceCell(target.art[y], x, ' ');
    target.ink[y] = replaceCell(target.ink[y], x, '.');
    target.bgInk[y] = replaceCell(target.bgInk[y], x, '.');
    return;
  }
  if (ui.applyGlyph.checked) target.art[y] = replaceCell(target.art[y], x, String.fromCodePoint(app.glyphCodepoint));
  if (ui.applyForeground.checked) {
    const key = keyForRole(app.sprite, app.foregroundRole);
    target.ink[y] = replaceCell(target.ink[y], x, key);
  }
  if (ui.applyBackground.checked) {
    ensureBackground(target);
    const key = app.backgroundRole === null ? '.' : keyForRole(app.sprite, app.backgroundRole);
    target.bgInk[y] = replaceCell(target.bgInk[y], x, key);
  }
}

function applyColourAt(x, y, hex) {
  const target = currentTarget();
  if (!target) return;
  const role = ensureCustomRole(hex);
  const key = keyForRole(app.sprite, role);
  if (ui.applyForeground.checked) target.ink[y] = replaceCell(target.ink[y], x, key);
  if (ui.applyBackground.checked) {
    ensureBackground(target);
    target.bgInk[y] = replaceCell(target.bgInk[y], x, key);
  }
}

function applyColourBrush(centerX, centerY) {
  if (!ui.applyForeground.checked && !ui.applyBackground.checked) return;
  const size = app.brushSize;
  const start = -Math.floor((size - 1) / 2);
  const end = start + size - 1;
  const geometricCenter = (start + end) / 2;
  const radius = Math.max(0.5, size / 2);
  for (let offsetY = start; offsetY <= end; offsetY++) {
    for (let offsetX = start; offsetX <= end; offsetX++) {
      const x = centerX + offsetX;
      const y = centerY + offsetY;
      if (x < 0 || y < 0 || x >= app.sprite.cell[0] || y >= app.sprite.cell[1]) continue;
      const dx = offsetX - geometricCenter;
      const dy = offsetY - geometricCenter;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (app.brushShape === 'circle' && distance > radius) continue;
      let amount = 0;
      if (app.brushMode === 'linear') {
        if (size === 1) amount = 0;
        else if (app.brushDirection === 'vertical') amount = (offsetY - start) / (size - 1);
        else if (app.brushDirection === 'diagonal') amount = ((offsetX - start) + (offsetY - start)) / (2 * (size - 1));
        else amount = (offsetX - start) / (size - 1);
      }
      else if (app.brushMode === 'radial') amount = clamp(distance / radius);
      applyColourAt(x, y, mixHex(app.colours[0], app.colours[1], amount));
    }
  }
}

function pickAt(x, y) {
  const target = currentTarget();
  if (!target) return;
  const char = cells(target.art[y])[x];
  if (char !== ' ' && app.glyphIndex.has(char.codePointAt(0))) app.glyphCodepoint = char.codePointAt(0);
  const inkKey = cells(target.ink[y])[x];
  const foreground = roleForKey(app.sprite, inkKey);
  if (typeof foreground === 'string') app.foregroundRole = foreground;
  const bgKey = cells(target.bgInk?.[y] ?? '.'.repeat(app.sprite.cell[0]))[x];
  const background = roleForKey(app.sprite, bgKey);
  app.backgroundRole = typeof background === 'string' ? background : null;
  const pickedHex = roleColour(foreground);
  if (pickedHex && /^#[0-9a-f]{6}$/i.test(pickedHex)) setActiveColour(pickedHex);
  renderRoleControls();
  renderGlyphBrowser();
  renderSelectedGlyph();
  toast(`Picked ${char === ' ' ? 'SPACE' : char} at ${x},${y}`);
}

function floodFill(startX, startY) {
  const target = currentTarget();
  if (!target) return;
  ensureBackground(target);
  const before = {
    art: cells(target.art[startY])[startX],
    ink: cells(target.ink[startY])[startX],
    bg: cells(target.bgInk[startY])[startX],
  };
  const matches = (x, y) => {
    const glyphMatches = !ui.applyGlyph.checked || cells(target.art[y])[x] === before.art;
    const foregroundMatches = !ui.applyForeground.checked || cells(target.ink[y])[x] === before.ink;
    const backgroundMatches = !ui.applyBackground.checked || cells(target.bgInk[y])[x] === before.bg;
    return glyphMatches && foregroundMatches && backgroundMatches;
  };
  const queue = [{ x: startX, y: startY }];
  const visited = new Set();
  while (queue.length) {
    const { x, y } = queue.pop();
    const id = `${x},${y}`;
    if (visited.has(id) || x < 0 || y < 0 || x >= app.sprite.cell[0] || y >= app.sprite.cell[1] || !matches(x, y)) continue;
    visited.add(id);
    applyAt(x, y, 'pencil');
    queue.push({ x: x - 1, y }, { x: x + 1, y }, { x, y: y - 1 }, { x, y: y + 1 });
  }
}

function applyRectangle(rect, filled) {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      if (filled || x === rect.x || y === rect.y || x === rect.x + rect.width - 1 || y === rect.y + rect.height - 1) {
        applyAt(x, y, 'pencil');
      }
    }
  }
}

function copySelection() {
  const target = currentTarget();
  if (!target || !app.sprite) return;
  const rect = app.selection ?? { x: 0, y: 0, width: app.sprite.cell[0], height: app.sprite.cell[1] };
  ensureBackground(target);
  const take = (rows) => rows.slice(rect.y, rect.y + rect.height)
    .map((row) => cells(row).slice(rect.x, rect.x + rect.width).join(''));
  app.clipboard = { width: rect.width, height: rect.height, art: take(target.art), ink: take(target.ink), bgInk: take(target.bgInk) };
  toast(`Copied ${rect.width} x ${rect.height} cells`);
}

function pasteSelection() {
  const target = currentTarget();
  if (!target || !app.clipboard) return;
  const origin = app.selection ? { x: app.selection.x, y: app.selection.y } : app.hoverCell ?? { x: 0, y: 0 };
  historySnapshot();
  ensureBackground(target);
  for (let y = 0; y < app.clipboard.height; y++) {
    for (let x = 0; x < app.clipboard.width; x++) {
      const tx = origin.x + x;
      const ty = origin.y + y;
      if (tx >= app.sprite.cell[0] || ty >= app.sprite.cell[1]) continue;
      target.art[ty] = replaceCell(target.art[ty], tx, cells(app.clipboard.art[y])[x]);
      target.ink[ty] = replaceCell(target.ink[ty], tx, cells(app.clipboard.ink[y])[x]);
      target.bgInk[ty] = replaceCell(target.bgInk[ty], tx, cells(app.clipboard.bgInk[y])[x]);
    }
  }
  markChanged();
  toast(`Pasted at ${origin.x},${origin.y}`);
}

function cycleVariation(delta) {
  const count = 1 + (currentState()?.variations?.length ?? 0);
  if (count < 1) return;
  app.variationIndex = (app.variationIndex + delta + count) % count;
  app.frameIndex = 0;
  renderTimeline();
  renderCanvas();
}

function cycleFrame(delta) {
  const state = currentState();
  if (!state) return;
  const count = framesFor(state, app.variationIndex).length;
  if (count < 1) return;
  app.frameIndex = (app.frameIndex + delta + count) % count;
  renderTimeline();
  renderCanvas();
}

function startPlayback() {
  const state = currentState();
  if (!state) return;
  const count = framesFor(state, app.variationIndex).length;
  if (count < 2) return;
  app.playing = true;
  const tick = () => {
    if (!app.playing) return;
    cycleFrame(1);
    app.playTimer = setTimeout(tick, Math.max(60, app.sprite.frameMs ?? 720));
  };
  app.playTimer = setTimeout(tick, Math.max(60, app.sprite.frameMs ?? 720));
  renderTimeline();
}

function stopPlayback() {
  app.playing = false;
  clearTimeout(app.playTimer);
  app.playTimer = null;
  if (app.sprite) renderTimeline();
}

function togglePlayback() {
  if (app.playing) stopPlayback(); else startPlayback();
}

function addState(duplicate) {
  if (!app.sprite) return;
  const key = prompt('New state key (empty means BASE):', duplicate ? `${app.stateKey}_copy` : '');
  if (key === null) return;
  if (Object.prototype.hasOwnProperty.call(app.sprite.states, key)) {
    toast(`State '${stateLabel(key)}' already exists`);
    return;
  }
  historySnapshot();
  app.sprite.states[key] = duplicate && currentState()
    ? clone(currentState())
    : makeFrame(app.sprite.cell[0], app.sprite.cell[1]);
  app.stateKey = key;
  app.variationIndex = 0;
  app.frameIndex = 0;
  markChanged(true);
}

function renameState() {
  if (!app.sprite) return;
  const next = prompt('State key:', app.stateKey);
  if (next === null || next === app.stateKey) return;
  if (Object.prototype.hasOwnProperty.call(app.sprite.states, next)) {
    toast(`State '${stateLabel(next)}' already exists`);
    return;
  }
  historySnapshot();
  const updated = {};
  for (const [key, state] of Object.entries(app.sprite.states)) updated[key === app.stateKey ? next : key] = state;
  app.sprite.states = updated;
  app.stateKey = next;
  markChanged(true);
}

function deleteState() {
  if (!app.sprite) return;
  if (Object.keys(app.sprite.states).length === 1) {
    toast('A sprite must keep at least one state');
    return;
  }
  if (!confirm(`Delete state '${stateLabel(app.stateKey)}'? You can still Undo.`)) return;
  historySnapshot();
  delete app.sprite.states[app.stateKey];
  app.stateKey = sortedStateKeys()[0];
  app.variationIndex = 0;
  app.frameIndex = 0;
  markChanged(true);
}

function addVariation() {
  const state = currentState();
  const target = currentBody();
  if (!state || !target) return;
  historySnapshot();
  const variation = { art: clone(target.art), ink: clone(target.ink) };
  if (target.bgInk) variation.bgInk = clone(target.bgInk);
  if (target.frames) variation.frames = clone(target.frames);
  state.variations ??= [];
  state.variations.push(variation);
  app.variationIndex = state.variations.length;
  app.frameIndex = 0;
  markChanged(true);
}

function deleteVariation() {
  const state = currentState();
  if (!state || app.variationIndex === 0) return;
  historySnapshot();
  state.variations.splice(app.variationIndex - 1, 1);
  app.variationIndex = Math.min(app.variationIndex - 1, state.variations.length);
  app.frameIndex = 0;
  if (!state.variations.length) delete state.variations;
  markChanged(true);
}

function addFrame() {
  const body = currentBody();
  const target = currentTarget();
  if (!body || !target) return;
  historySnapshot();
  const frame = { art: clone(target.art), ink: clone(target.ink) };
  if (target.bgInk) frame.bgInk = clone(target.bgInk);
  body.frames ??= [];
  body.frames.push(frame);
  app.frameIndex = body.frames.length;
  markChanged(true);
}

function deleteFrame() {
  const body = currentBody();
  if (!body || app.frameIndex === 0) return;
  historySnapshot();
  body.frames.splice(app.frameIndex - 1, 1);
  app.frameIndex = Math.min(app.frameIndex - 1, body.frames.length);
  if (!body.frames.length) delete body.frames;
  markChanged(true);
}

function runValidation(expand = true) {
  if (!app.sprite) return null;
  const result = validateSprite(app.sprite, {
    paletteRoles: app.palette.roles,
    glyphCodepoints: app.glyphset?.codepoints,
    expectedCell: app.contentGrid?.cell,
  });
  const count = result.errors.length + result.warnings.length;
  ui.validationPill.className = 'validation-pill';
  if (result.errors.length) {
    ui.validationPill.classList.add('error');
    ui.validationPill.textContent = `${result.errors.length} error${result.errors.length === 1 ? '' : 's'}`;
  } else if (result.warnings.length) {
    ui.validationPill.classList.add('warning');
    ui.validationPill.textContent = `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;
  } else {
    ui.validationPill.classList.add('ok');
    ui.validationPill.textContent = 'Valid Sprite v2';
  }
  ui.validationPanel.replaceChildren();
  if (count) {
    const list = document.createElement('ul');
    result.errors.forEach((message) => {
      const item = document.createElement('li');
      item.className = 'error-text';
      item.textContent = message;
      list.append(item);
    });
    result.warnings.forEach((message) => {
      const item = document.createElement('li');
      item.className = 'warning-text';
      item.textContent = message;
      list.append(item);
    });
    ui.validationPanel.append(list);
  } else {
    ui.validationPanel.textContent = 'All dimensions, ink keys, palette roles, and glyphs pass the editor checks.';
  }
  if (expand) ui.validationPanel.classList.toggle('hidden');
  return result;
}

function downloadJson(data, filename) {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadSprite() {
  if (!app.sprite) return;
  const result = runValidation(false);
  if (result.errors.length) {
    ui.validationPanel.classList.remove('hidden');
    toast('Fix validation errors before downloading');
    return;
  }
  const filename = `${app.sprite.id}.json`;
  downloadJson(app.sprite, filename);
  app.dirty = false;
  updateHistoryButtons();
  toast(`Downloaded ${filename}${customRolesUsed().length ? '; also download the palette patch' : ''}`, 4200);
}

function downloadPalettePatch() {
  if (!app.sprite) return;
  const roles = Object.fromEntries(customRolesUsed().map((role) => [role, app.palette.roles[role]]));
  if (!Object.keys(roles).length) return;
  downloadJson({ $schema: '../schema/palette.schema.json', roles }, `${app.sprite.id}.palette-patch.json`);
  toast(`Downloaded ${app.sprite.id}.palette-patch.json`);
}

async function readJsonFile(file) {
  try {
    return JSON.parse(await file.text());
  } catch (error) {
    throw new Error(`${file.name}: ${error.message}`);
  }
}

async function fetchJson(path) {
  const embedded = window.__SPRITE_EDITOR_ASSETS__;
  if (embedded) {
    if (path.endsWith('/palette.json')) return clone(embedded.palette);
    if (path.endsWith('/grid.json')) return clone(embedded.grid);
    if (path.endsWith('/glyphset-spleen.json')) return clone(embedded.glyphset);
    const spriteMatch = /\/sprites\/([^/]+)\.json$/.exec(path);
    if (spriteMatch && embedded.sprites?.[spriteMatch[1]]) return clone(embedded.sprites[spriteMatch[1]]);
  }
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function convertForCompanion(doc, filename) {
  const kind = detectDocumentKind(doc);
  if (kind === 'tower-study') {
    const id = inferTowerId(filename, doc);
    if (!id) throw new Error('Legacy tower layer filename must identify its matching tower');
    const reference = await fetchJson(`../packages/content/assets/sprites/${id}.json`);
    return convertDocument(doc, { filename, runtimeReference: reference });
  }
  return convertDocument(doc, { filename });
}

function setCompanion(sprite, filename) {
  if (app.sprite && (sprite.cell[0] !== app.sprite.cell[0] || sprite.cell[1] !== app.sprite.cell[1])) {
    throw new Error(`Layer cell [${sprite.cell}] does not match open sprite [${app.sprite.cell}]`);
  }
  app.companion = sprite;
  app.companionFilename = filename;
  app.companionStateKey = Object.prototype.hasOwnProperty.call(sprite.states, '') ? '' : sortedSpriteStateKeys(sprite)[0];
  app.companionVariationIndex = 0;
  renderPreviewControls();
  renderCanvas();
}

async function openCompanionFile(file) {
  setCompanion(await convertForCompanion(await readJsonFile(file), file.name), file.name);
  toast(`Loaded preview layer ${app.companion.id}`);
}

async function openBundledCompanion(id) {
  if (!id) return;
  setCompanion(await fetchJson(`../packages/content/assets/sprites/${id}.json`), `${id}.json`);
  ui.companionExampleSelect.value = '';
  toast(`Loaded preview layer ${id}`);
}

async function openDocumentFile(file) {
  const doc = await readJsonFile(file);
  const kind = detectDocumentKind(doc);
  if (kind === 'tower-study') {
    const id = inferTowerId(file.name, doc);
    if (!id) {
      app.pendingStudy = { doc, filename: file.name };
      ui.referenceInput.click();
      toast('Choose the matching runtime Sprite v2 colour reference');
      return;
    }
    try {
      const reference = await fetchJson(`../packages/content/assets/sprites/${id}.json`);
      setSprite(convertDocument(doc, { filename: file.name, runtimeReference: reference }), file.name);
      toast(`Converted ${id} tower study to Sprite v2`);
    } catch (error) {
      app.pendingStudy = { doc, filename: file.name };
      ui.referenceInput.click();
      toast(`Could not auto-load ${id} colours; choose its runtime sprite`);
    }
    return;
  }
  setSprite(convertDocument(doc, { filename: file.name }), file.name);
  toast(kind === 'road-study' ? 'Converted road study to Sprite v2' : `Opened ${file.name}`);
}

async function acceptTowerReference(file) {
  const reference = await readJsonFile(file);
  if (detectDocumentKind(reference) !== 'runtime') throw new Error('Tower reference must be a runtime Sprite v2 JSON');
  if (!app.pendingStudy) {
    toast('Open a legacy tower study first, then supply its reference');
    return;
  }
  const { doc, filename } = app.pendingStudy;
  setSprite(convertDocument(doc, { filename, runtimeReference: reference }), filename);
  app.pendingStudy = null;
  toast('Converted tower study to Sprite v2');
}

async function openBundled(id) {
  if (!id) return;
  const sprite = await fetchJson(`../packages/content/assets/sprites/${id}.json`);
  setSprite(sprite, `${id}.json`);
  ui.exampleSelect.value = '';
  toast(`Opened bundled ${id}`);
}

function createNewSprite() {
  const id = prompt('Sprite id (lowercase letters, digits, underscores):', 'new_sprite');
  if (id === null) return;
  if (!/^[a-z][a-z0-9_]*$/.test(id)) {
    toast('Invalid sprite id');
    return;
  }
  const defaultCell = app.contentGrid?.cell?.join(',') ?? '8,5';
  const dimensions = prompt('Cell size as width,height:', defaultCell);
  if (dimensions === null) return;
  const match = /^\s*(\d+)\s*,\s*(\d+)\s*$/.exec(dimensions);
  if (!match || Number(match[1]) < 1 || Number(match[2]) < 1) {
    toast('Cell size must look like 8,5');
    return;
  }
  const width = Number(match[1]);
  const height = Number(match[2]);
  const sprite = {
    $schema: '../../schema/sprite.schema.json',
    id,
    cell: [width, height],
    frameMs: 720,
    source: 'created with sprite-editor',
    states: { '': makeFrame(width, height, 'a') },
    inkMap: { '.': null, a: 'PATH' },
  };
  setSprite(sprite, `${id}.json`);
}

function setTool(tool) {
  app.tool = tool;
  $$('.tool').forEach((button) => button.classList.toggle('active', button.dataset.tool === tool));
  ui.canvas.style.cursor = tool === 'eyedropper' ? 'copy' : tool === 'select' ? 'cell' : 'crosshair';
}

ui.canvas.addEventListener('pointerdown', (event) => {
  if (app.viewMode !== 'edit') {
    toast('Switch to Edit to paint; preview canvases are read-only');
    return;
  }
  const point = canvasCell(event);
  if (!point || !currentTarget()) return;
  ui.canvas.setPointerCapture(event.pointerId);
  app.hoverCell = point;
  if (app.tool === 'eyedropper' || event.button === 2 || event.altKey) {
    pickAt(point.x, point.y);
    return;
  }
  if (app.tool === 'fill') {
    historySnapshot();
    floodFill(point.x, point.y);
    markChanged();
    return;
  }
  if (app.tool === 'rectangle' || app.tool === 'select') {
    app.dragStart = point;
    app.dragEnd = point;
    renderCanvas();
    return;
  }
  historySnapshot();
  app.painting = true;
  app.lastPaintCell = `${point.x},${point.y}`;
  if (app.tool === 'brush') applyColourBrush(point.x, point.y);
  else applyAt(point.x, point.y);
  markChanged();
});

ui.canvas.addEventListener('pointermove', (event) => {
  const point = canvasCell(event);
  app.hoverCell = point;
  ui.cellStatus.textContent = point ? `Cell ${point.x}, ${point.y}` : 'Cell --, --';
  if (!point) return;
  if (app.dragStart) {
    app.dragEnd = point;
    renderCanvas();
    return;
  }
  if (app.painting) {
    const id = `${point.x},${point.y}`;
    if (id !== app.lastPaintCell) {
      app.lastPaintCell = id;
      if (app.tool === 'brush') applyColourBrush(point.x, point.y);
      else applyAt(point.x, point.y);
      markChanged();
    }
  }
});

function endCanvasDrag(event) {
  if (app.dragStart && app.dragEnd) {
    const rect = normalizedRect(app.dragStart, app.dragEnd);
    if (app.tool === 'select') {
      app.selection = rect;
      ui.selectionStatus.textContent = `${rect.width} x ${rect.height} selected`;
    } else {
      historySnapshot();
      applyRectangle(rect, event.shiftKey);
      markChanged();
    }
  }
  app.painting = false;
  app.lastPaintCell = null;
  app.dragStart = null;
  app.dragEnd = null;
  renderRoleControls();
  renderPreviewControls();
  renderCanvas();
}

ui.canvas.addEventListener('pointerup', endCanvasDrag);
ui.canvas.addEventListener('pointercancel', endCanvasDrag);
ui.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
ui.canvas.addEventListener('pointerleave', () => {
  if (!app.painting && !app.dragStart) ui.cellStatus.textContent = 'Cell --, --';
});

ui.glyphCanvas.addEventListener('pointerdown', (event) => {
  const rect = ui.glyphCanvas.getBoundingClientRect();
  const scaleX = ui.glyphCanvas.width / rect.width;
  const scaleY = ui.glyphCanvas.height / rect.height;
  const columns = Number(ui.glyphCanvas.dataset.columns || 1);
  const x = Math.floor((event.clientX - rect.left) * scaleX / 29);
  const y = Math.floor((event.clientY - rect.top) * scaleY / 35);
  const cp = app.glyphLayout[y * columns + x];
  if (cp === undefined) return;
  app.glyphCodepoint = cp;
  renderGlyphBrowser();
  renderSelectedGlyph();
});

ui.newButton.addEventListener('click', createNewSprite);
ui.openButton.addEventListener('click', () => ui.fileInput.click());
ui.referenceButton.addEventListener('click', () => ui.referenceInput.click());
ui.loadPaletteButton.addEventListener('click', () => ui.paletteInput.click());
ui.loadGlyphsetButton.addEventListener('click', () => ui.glyphsetInput.click());
ui.saveButton.addEventListener('click', downloadSprite);
ui.palettePatchButton.addEventListener('click', downloadPalettePatch);
ui.undoButton.addEventListener('click', undo);
ui.redoButton.addEventListener('click', redo);
ui.fileInput.addEventListener('change', () => ui.fileInput.files[0] && openDocumentFile(ui.fileInput.files[0]).catch((error) => toast(error.message, 5000)));
ui.referenceInput.addEventListener('change', () => ui.referenceInput.files[0] && acceptTowerReference(ui.referenceInput.files[0]).catch((error) => toast(error.message, 5000)));
ui.paletteInput.addEventListener('change', async () => {
  if (!ui.paletteInput.files[0]) return;
  try {
    const palette = await readJsonFile(ui.paletteInput.files[0]);
    if (!palette.roles || typeof palette.roles !== 'object') throw new Error('Palette JSON must contain a roles object');
    app.palette = { ...app.palette, roles: { ...app.palette.roles, ...palette.roles } };
    renderRoleControls();
    renderPreviewControls();
    renderCanvas();
    runValidation(false);
    toast(`Merged ${Object.keys(palette.roles).length} palette roles`);
  } catch (error) { toast(error.message, 5000); }
});
ui.glyphsetInput.addEventListener('change', async () => {
  if (!ui.glyphsetInput.files[0]) return;
  try {
    decodeGlyphset(await readJsonFile(ui.glyphsetInput.files[0]));
    runValidation(false);
    toast(`Loaded ${app.glyphset.codepoints.length} glyphs`);
  } catch (error) { toast(error.message, 5000); }
});
ui.exampleSelect.addEventListener('change', () => openBundled(ui.exampleSelect.value).catch((error) => toast(`Cannot open bundled sprite: ${error.message}`, 5000)));
ui.viewMode.addEventListener('change', () => {
  app.viewMode = ui.viewMode.value;
  app.selection = null;
  renderPreviewControls();
  renderCanvas();
});
ui.compareButton.addEventListener('click', () => {
  app.compareFrames = !app.compareFrames;
  renderFrameCompare();
});
ui.tileColsInput.addEventListener('change', () => {
  app.tileCols = Math.max(1, Math.min(8, Number(ui.tileColsInput.value) || 1));
  renderPreviewControls();
  renderCanvas();
});
ui.tileRowsInput.addEventListener('change', () => {
  app.tileRows = Math.max(1, Math.min(8, Number(ui.tileRowsInput.value) || 1));
  renderPreviewControls();
  renderCanvas();
});
ui.cycleVariationsCheckbox.addEventListener('change', renderCanvas);
ui.loadCompanionButton.addEventListener('click', () => ui.companionInput.click());
ui.companionInput.addEventListener('change', () => ui.companionInput.files[0]
  && openCompanionFile(ui.companionInput.files[0]).catch((error) => toast(error.message, 5000)));
ui.companionExampleSelect.addEventListener('change', () => openBundledCompanion(ui.companionExampleSelect.value)
  .catch((error) => toast(error.message, 5000)));
ui.companionStateSelect.addEventListener('change', () => {
  app.companionStateKey = ui.companionStateSelect.value;
  app.companionVariationIndex = 0;
  renderPreviewControls();
  renderCanvas();
});
ui.companionVariationSelect.addEventListener('change', () => {
  app.companionVariationIndex = Number(ui.companionVariationSelect.value);
  renderCanvas();
});
ui.companionLayerSelect.addEventListener('change', () => {
  app.companionLayer = ui.companionLayerSelect.value;
  renderCanvas();
});
ui.clearCompanionButton.addEventListener('click', () => {
  app.companion = null;
  app.companionFilename = '';
  renderPreviewControls();
  renderCanvas();
});
$$('.frame-preview[data-frame-offset]').forEach((button) => button.addEventListener('click', () => cycleFrame(Number(button.dataset.frameOffset))));
ui.addStateButton.addEventListener('click', () => addState(false));
ui.duplicateStateButton.addEventListener('click', () => addState(true));
ui.renameStateButton.addEventListener('click', renameState);
ui.deleteStateButton.addEventListener('click', deleteState);
ui.variationSelect.addEventListener('change', () => {
  app.variationIndex = Number(ui.variationSelect.value);
  app.frameIndex = 0;
  renderTimeline();
  renderCanvas();
});
ui.previousVariationButton.addEventListener('click', () => cycleVariation(-1));
ui.nextVariationButton.addEventListener('click', () => cycleVariation(1));
ui.addVariationButton.addEventListener('click', addVariation);
ui.deleteVariationButton.addEventListener('click', deleteVariation);
ui.frameSelect.addEventListener('change', () => { app.frameIndex = Number(ui.frameSelect.value); renderCanvas(); });
ui.previousFrameButton.addEventListener('click', () => cycleFrame(-1));
ui.nextFrameButton.addEventListener('click', () => cycleFrame(1));
ui.addFrameButton.addEventListener('click', addFrame);
ui.deleteFrameButton.addEventListener('click', deleteFrame);
ui.playButton.addEventListener('click', togglePlayback);
ui.frameMsInput.addEventListener('change', () => {
  if (!app.sprite) return;
  const next = Math.max(60, Math.round(Number(ui.frameMsInput.value) || 720));
  historySnapshot();
  app.sprite.frameMs = next;
  markChanged(true);
  if (app.playing) { stopPlayback(); startPlayback(); }
});
ui.gridCheckbox.addEventListener('change', () => { app.grid = ui.gridCheckbox.checked; renderCanvas(); });
ui.zoomInput.addEventListener('input', () => {
  app.zoom = Number(ui.zoomInput.value);
  ui.zoomLabel.textContent = `${app.zoom}x`;
  renderCanvas();
});
ui.validateButton.addEventListener('click', () => runValidation(true));
ui.foregroundSelect.addEventListener('change', () => {
  app.foregroundRole = ui.foregroundSelect.value;
  renderRoleControls();
  renderSelectedGlyph();
});
ui.backgroundSelect.addEventListener('change', () => {
  app.backgroundRole = ui.backgroundSelect.value || null;
  renderRoleControls();
});
ui.colourSlotA.addEventListener('click', () => { app.colourSlot = 0; renderColourLab(); });
ui.colourSlotB.addEventListener('click', () => { app.colourSlot = 1; renderColourLab(); });
ui.colourHexInput.addEventListener('change', () => {
  if (!setActiveColour(ui.colourHexInput.value)) {
    ui.colourHexInput.value = activeColour().toUpperCase();
    toast('Colour must be a six-digit hex value such as #2ee6a0');
  }
});
ui.colourValueInput.addEventListener('input', () => {
  const hsv = app.colourHsv[app.colourSlot];
  hsv.v = Number(ui.colourValueInput.value) / 100;
  app.colours[app.colourSlot] = rgbToHex(hsvToRgb(hsv));
  renderColourLab();
});
function updateColourFromWheel(event) {
  const rect = ui.colourWheel.getBoundingClientRect();
  const x = (event.clientX - rect.left) * ui.colourWheel.width / rect.width;
  const y = (event.clientY - rect.top) * ui.colourWheel.height / rect.height;
  const cx = ui.colourWheel.width / 2;
  const cy = ui.colourWheel.height / 2;
  const dx = x - cx;
  const dy = y - cy;
  const radius = Math.min(cx, cy) - 3;
  const saturation = Math.sqrt(dx * dx + dy * dy) / radius;
  if (saturation > 1.08) return;
  const hsv = app.colourHsv[app.colourSlot];
  hsv.h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
  hsv.s = clamp(saturation);
  app.colours[app.colourSlot] = rgbToHex(hsvToRgb(hsv));
  renderColourLab();
}
ui.colourWheel.addEventListener('pointerdown', (event) => {
  ui.colourWheel.setPointerCapture(event.pointerId);
  updateColourFromWheel(event);
});
ui.colourWheel.addEventListener('pointermove', (event) => {
  if (ui.colourWheel.hasPointerCapture(event.pointerId)) updateColourFromWheel(event);
});
ui.useForegroundButton.addEventListener('click', () => {
  if (!app.sprite) return toast('Open a sprite first');
  app.foregroundRole = ensureCustomRole(activeColour());
  renderRoleControls();
  renderSelectedGlyph();
  toast(`Foreground set to ${activeColour()}`);
});
ui.useBackgroundButton.addEventListener('click', () => {
  if (!app.sprite) return toast('Open a sprite first');
  app.backgroundRole = ensureCustomRole(activeColour());
  renderRoleControls();
  toast(`Background set to ${activeColour()}`);
});
ui.brushSizeInput.addEventListener('input', () => {
  app.brushSize = Number(ui.brushSizeInput.value);
  ui.brushSizeLabel.textContent = String(app.brushSize);
});
ui.brushShapeSelect.addEventListener('change', () => { app.brushShape = ui.brushShapeSelect.value; });
ui.brushModeSelect.addEventListener('change', () => { app.brushMode = ui.brushModeSelect.value; });
ui.brushDirectionSelect.addEventListener('change', () => { app.brushDirection = ui.brushDirectionSelect.value; });
ui.glyphSearch.addEventListener('input', renderGlyphBrowser);
ui.glyphRange.addEventListener('change', renderGlyphBrowser);
$$('.tool').forEach((button) => button.addEventListener('click', () => setTool(button.dataset.tool)));

window.addEventListener('keydown', (event) => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
  if (event.ctrlKey || event.metaKey) {
    const key = event.key.toLowerCase();
    if (key === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
    else if (key === 'y') { event.preventDefault(); redo(); }
    else if (key === 's') { event.preventDefault(); downloadSprite(); }
    else if (key === 'c') { event.preventDefault(); copySelection(); }
    else if (key === 'v') { event.preventDefault(); pasteSelection(); }
    return;
  }
  const tools = { 1: 'pencil', 2: 'eraser', 3: 'fill', 4: 'eyedropper', 5: 'rectangle', 6: 'select', 7: 'brush' };
  if (tools[event.key]) setTool(tools[event.key]);
  else if (event.key === '[') cycleVariation(-1);
  else if (event.key === ']') cycleVariation(1);
  else if (event.key === ',') cycleFrame(-1);
  else if (event.key === '.') cycleFrame(1);
  else if (event.key === ' ') { event.preventDefault(); togglePlayback(); }
});

window.addEventListener('dragenter', (event) => { event.preventDefault(); document.body.classList.add('dragging'); });
window.addEventListener('dragover', (event) => event.preventDefault());
window.addEventListener('dragleave', (event) => {
  if (event.relatedTarget === null) document.body.classList.remove('dragging');
});
window.addEventListener('drop', (event) => {
  event.preventDefault();
  document.body.classList.remove('dragging');
  const file = [...event.dataTransfer.files].find((candidate) => candidate.name.toLowerCase().endsWith('.json'));
  if (file) openDocumentFile(file).catch((error) => toast(error.message, 5000));
});
window.addEventListener('resize', renderGlyphBrowser);
window.addEventListener('beforeunload', (event) => {
  if (!app.dirty) return;
  event.preventDefault();
  event.returnValue = '';
});

async function loadProjectResources() {
  const failures = [];
  try {
    app.palette = await fetchJson('../packages/content/assets/palette.json');
  } catch (error) {
    failures.push('palette');
  }
  try {
    app.contentGrid = await fetchJson('../packages/content/assets/grid.json');
  } catch (error) {
    failures.push('project grid');
  }
  try {
    decodeGlyphset(await fetchJson('../packages/app/public/assets/glyphset-spleen.json'));
  } catch (error) {
    failures.push('glyph atlas');
  }
  renderAll();
  if (failures.length) toast(`Could not auto-load ${failures.join(' and ')}. Serve the repository root over HTTP.`, 6000);
}

loadProjectResources();
