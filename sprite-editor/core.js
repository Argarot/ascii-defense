const ROAD_ORDER = ['|', '-', 'L', 'J', 'F', '7', 'T', 'U', 'E', '3', 'X', 'B'];

export const INK_KEY_ALPHABET =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function cells(row) {
  return Array.from(row ?? '');
}

export function detectDocumentKind(doc) {
  if (!doc || typeof doc !== 'object') return 'unknown';
  if (doc.states && !Array.isArray(doc.states) && doc.inkMap) return 'runtime';
  if (Array.isArray(doc.states) && doc.meta?.canvasGlyphs) return 'tower-study';
  if (doc.tiers && doc.inkMap && Array.isArray(doc.cell)) return 'road-study';
  return 'unknown';
}

export function inferTowerId(filename, study) {
  const haystack = `${filename ?? ''} ${study?.meta?.selectedConcept ?? ''}`.toLowerCase();
  for (const id of ['bolt', 'mortar', 'frost', 'refinery']) {
    if (haystack.includes(id)) return id;
  }
  return null;
}

function sourceLabel(filename) {
  return filename ? `converted from ${filename} by sprite-editor` : 'converted by sprite-editor';
}

function assertRows(rows, width, height, label) {
  if (!Array.isArray(rows) || rows.length !== height) {
    throw new Error(`${label} must contain ${height} rows`);
  }
  rows.forEach((row, y) => {
    if (cells(row).length !== width) {
      throw new Error(`${label} row ${y + 1} must be ${width} glyphs wide`);
    }
  });
}

function copyColourGrid(referenceFrame, art, label) {
  if (!referenceFrame?.ink) {
    throw new Error(`${label} has no matching colour grid in the runtime reference`);
  }
  const result = { art: clone(art), ink: clone(referenceFrame.ink) };
  if (referenceFrame.bgInk) result.bgInk = clone(referenceFrame.bgInk);
  return result;
}

export function convertTowerStudy(study, { filename = '', runtimeReference } = {}) {
  const id = inferTowerId(filename, study);
  if (!id) {
    throw new Error('This tower study needs a recognizable tower id in its filename');
  }
  if (!runtimeReference || detectDocumentKind(runtimeReference) !== 'runtime') {
    throw new Error(`The ${id} study needs its matching runtime Sprite v2 JSON for colour roles`);
  }
  if (runtimeReference.id !== id) {
    throw new Error(`Runtime reference '${runtimeReference.id}' does not match tower study '${id}'`);
  }

  const cell = clone(study.meta.canvasGlyphs);
  const [width, height] = cell;
  const tiers = ['T1', 'T2', 'T3'].map((key) => Object.keys(study.choices?.[key] ?? {}));
  const states = {};

  for (const sourceState of study.states) {
    const path = sourceState.path === 'BASE' ? '' : sourceState.path;
    const key = Array.from(path).map((letter, tierIndex) => {
      const optionIndex = tiers[tierIndex]?.indexOf(letter) ?? -1;
      if (optionIndex < 0) {
        throw new Error(`Unknown choice '${letter}' in study path '${path}'`);
      }
      return String(optionIndex);
    }).join('');
    const referenceState = runtimeReference.states[key];
    if (!referenceState) throw new Error(`Runtime reference has no state '${key || 'BASE'}'`);

    assertRows(sourceState.idleA, width, height, `${sourceState.path} idleA`);
    assertRows(sourceState.idleB, width, height, `${sourceState.path} idleB`);
    const state = copyColourGrid(referenceState, sourceState.idleA, `state '${key}'`);
    const frameReference = referenceState.frames?.[0] ?? referenceState;
    state.frames = [copyColourGrid(frameReference, sourceState.idleB, `state '${key}' frame 1`)];
    states[key] = state;
  }

  return {
    $schema: '../../schema/sprite.schema.json',
    id,
    cell,
    frameMs: runtimeReference.frameMs ?? parseFrameMs(study.meta.animation),
    source: sourceLabel(filename),
    states,
    inkMap: clone(runtimeReference.inkMap),
  };
}

function parseFrameMs(text) {
  const match = /(\d+)\s*ms/i.exec(text ?? '');
  return match ? Number(match[1]) : 720;
}

function stripFrame(frame) {
  const result = { art: clone(frame.art), ink: clone(frame.ink) };
  if (frame.bgInk) result.bgInk = clone(frame.bgInk);
  return result;
}

export function convertRoadStudy(study, { filename = '' } = {}) {
  const states = {};
  for (const [tierKey, tier] of Object.entries(study.tiers)) {
    const stateKey = ROAD_ORDER[Number(tierKey)];
    if (stateKey === undefined) throw new Error(`Road tier '${tierKey}' has no state mapping`);
    const state = stripFrame(tier);
    if (tier.frames?.length) state.variations = tier.frames.map(stripFrame);
    states[stateKey] = state;
  }
  return {
    $schema: '../../schema/sprite.schema.json',
    id: study.id,
    cell: clone(study.cell),
    source: sourceLabel(filename),
    states,
    inkMap: clone(study.inkMap),
  };
}

export function convertDocument(doc, options = {}) {
  switch (detectDocumentKind(doc)) {
    case 'runtime': return clone(doc);
    case 'tower-study': return convertTowerStudy(doc, options);
    case 'road-study': return convertRoadStudy(doc, options);
    default: throw new Error('Unrecognized JSON. Expected Sprite v2, tower study, or road study');
  }
}

export function framesFor(state, variationIndex = 0) {
  const body = variationIndex === 0 ? state : state.variations?.[variationIndex - 1];
  return body ? [body, ...(body.frames ?? [])] : [];
}

export function targetFor(sprite, stateKey, variationIndex = 0, frameIndex = 0) {
  const state = sprite.states[stateKey];
  if (!state) return null;
  return framesFor(state, variationIndex)[frameIndex] ?? null;
}

export function roleForKey(sprite, key) {
  return Object.prototype.hasOwnProperty.call(sprite.inkMap, key)
    ? sprite.inkMap[key]
    : undefined;
}

export function keyForRole(sprite, role) {
  const existing = Object.entries(sprite.inkMap).find(([, mapped]) => mapped === role);
  if (existing) return existing[0];
  for (const key of INK_KEY_ALPHABET) {
    if (!Object.prototype.hasOwnProperty.call(sprite.inkMap, key)) {
      sprite.inkMap[key] = role;
      return key;
    }
  }
  // Ink keys are data, not rendered glyphs. BMP private-use characters give
  // gradient brushes ample room without colliding with readable hand-authored
  // keys or JSON's one-character schema constraint.
  for (let codepoint = 0xe000; codepoint <= 0xf8ff; codepoint++) {
    const key = String.fromCodePoint(codepoint);
    if (!Object.prototype.hasOwnProperty.call(sprite.inkMap, key)) {
      sprite.inkMap[key] = role;
      return key;
    }
  }
  throw new Error('This sprite has exhausted the available one-character ink keys');
}

export function replaceCell(row, x, value) {
  const values = cells(row);
  values[x] = value;
  return values.join('');
}

export function makeFrame(width, height, foregroundKey = '.') {
  return {
    art: Array.from({ length: height }, () => ' '.repeat(width)),
    ink: Array.from({ length: height }, () => foregroundKey.repeat(width)),
    bgInk: Array.from({ length: height }, () => '.'.repeat(width)),
  };
}

export function validateSprite(sprite, { paletteRoles = null, glyphCodepoints = null, expectedCell = null } = {}) {
  const errors = [];
  const warnings = [];
  if (!sprite || typeof sprite !== 'object') return { errors: ['Document is not an object'], warnings };
  if (!/^[a-z][a-z0-9_]*$/.test(sprite.id ?? '')) errors.push('id must use lowercase letters, digits, and underscores');
  if (!Array.isArray(sprite.cell) || sprite.cell.length !== 2 || sprite.cell.some((n) => !Number.isInteger(n) || n < 1)) {
    errors.push('cell must be [positive width, positive height]');
  }
  if (!sprite.states || typeof sprite.states !== 'object' || Array.isArray(sprite.states) || !Object.keys(sprite.states).length) {
    errors.push('states must be a non-empty object');
  }
  if (!sprite.inkMap || typeof sprite.inkMap !== 'object' || Array.isArray(sprite.inkMap)) {
    errors.push('inkMap must be an object');
  }
  if (errors.length) return { errors, warnings };

  const [width, height] = sprite.cell;
  if (expectedCell && (width !== expectedCell[0] || height !== expectedCell[1])) {
    errors.push(`cell [${width}, ${height}] does not match project grid [${expectedCell[0]}, ${expectedCell[1]}]`);
  }
  const allowedTop = new Set(['$schema', 'id', 'cell', 'frameMs', 'source', 'states', 'inkMap']);
  Object.keys(sprite).filter((key) => !allowedTop.has(key)).forEach((key) => errors.push(`unsupported top-level property '${key}'`));
  if (sprite.$schema !== undefined && typeof sprite.$schema !== 'string') errors.push('$schema must be a string');
  if (sprite.source !== undefined && typeof sprite.source !== 'string') errors.push('source must be a string');
  if (sprite.frameMs !== undefined && (!Number.isInteger(sprite.frameMs) || sprite.frameMs < 60)) {
    errors.push('frameMs must be an integer of at least 60');
  }
  const glyphs = glyphCodepoints ? new Set(glyphCodepoints) : null;
  const roles = paletteRoles ? new Set(Object.keys(paletteRoles)) : null;
  if (Object.prototype.hasOwnProperty.call(sprite.inkMap, '.') && sprite.inkMap['.'] !== null) {
    warnings.push("inkMap '.' should map to null transparency");
  }

  const checkRows = (rows, label, keyed) => {
    if (!Array.isArray(rows) || rows.length !== height) {
      errors.push(`${label} must have ${height} rows`);
      return;
    }
    rows.forEach((row, y) => {
      const rowCells = cells(row);
      if (rowCells.length !== width) errors.push(`${label} row ${y + 1} must be ${width} cells wide`);
      rowCells.forEach((value) => {
        if (keyed && !Object.prototype.hasOwnProperty.call(sprite.inkMap, value)) {
          errors.push(`${label} uses unmapped ink key '${value}'`);
        } else if (!keyed && value !== ' ' && glyphs && !glyphs.has(value.codePointAt(0))) {
          errors.push(`${label} uses glyph U+${value.codePointAt(0).toString(16).toUpperCase()} absent from the font`);
        }
      });
    });
  };
  const checkFrame = (frame, label, kind = 'frame') => {
    if (!frame || typeof frame !== 'object') {
      errors.push(`${label} is not an object`);
      return;
    }
    const allowed = kind === 'state'
      ? new Set(['art', 'ink', 'bgInk', 'frames', 'variations'])
      : kind === 'variation'
        ? new Set(['art', 'ink', 'bgInk', 'frames'])
        : new Set(['art', 'ink', 'bgInk']);
    Object.keys(frame).filter((key) => !allowed.has(key)).forEach((key) => errors.push(`${label} has unsupported property '${key}'`));
    checkRows(frame.art, `${label} art`, false);
    checkRows(frame.ink, `${label} ink`, true);
    if (frame.bgInk) checkRows(frame.bgInk, `${label} bgInk`, true);
  };

  for (const [stateKey, state] of Object.entries(sprite.states)) {
    checkFrame(state, `state '${stateKey || 'BASE'}'`, 'state');
    if (state.frames !== undefined && (!Array.isArray(state.frames) || !state.frames.length)) {
      errors.push(`state '${stateKey || 'BASE'}' frames must be a non-empty array when present`);
    }
    if (state.variations !== undefined && (!Array.isArray(state.variations) || !state.variations.length)) {
      errors.push(`state '${stateKey || 'BASE'}' variations must be a non-empty array when present`);
    }
    (state.frames ?? []).forEach((frame, index) => checkFrame(frame, `state '${stateKey || 'BASE'}' frame ${index + 1}`));
    (state.variations ?? []).forEach((variation, variationIndex) => {
      checkFrame(variation, `state '${stateKey || 'BASE'}' variation ${variationIndex + 1}`, 'variation');
      if (variation.frames !== undefined && (!Array.isArray(variation.frames) || !variation.frames.length)) {
        errors.push(`state '${stateKey || 'BASE'}' variation ${variationIndex + 1} frames must be a non-empty array when present`);
      }
      (variation.frames ?? []).forEach((frame, frameIndex) =>
        checkFrame(frame, `state '${stateKey || 'BASE'}' variation ${variationIndex + 1} frame ${frameIndex + 1}`));
    });
  }

  for (const [key, role] of Object.entries(sprite.inkMap)) {
    if (cells(key).length !== 1) errors.push(`inkMap key '${key}' must be one character`);
    if (role !== null && typeof role !== 'string') errors.push(`inkMap key '${key}' must map to a string role or null`);
    if (role !== null && role !== 'PATH' && roles && !roles.has(role)) {
      errors.push(`inkMap key '${key}' names palette role '${role}' that is not loaded`);
    }
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

export function stateLabel(key) {
  return key === '' ? 'BASE' : key;
}

export function codepointLabel(codepoint) {
  return `U+${codepoint.toString(16).toUpperCase().padStart(4, '0')}`;
}
