import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  convertDocument,
  convertRoadStudy,
  convertTowerStudy,
  detectDocumentKind,
  keyForRole,
  makeFrame,
  targetFor,
  validateSprite,
} from './core.js';

const frame = (art = ['ab', ' c']) => ({ art, ink: ['aa', '.a'], bgInk: ['..', '..'] });
const runtime = {
  id: 'bolt', cell: [2, 2], frameMs: 700,
  states: { '': { ...frame(), frames: [frame(['aB', ' c'])] }, '0': frame() },
  inkMap: { '.': null, a: 'tower.frame' },
};

assert.equal(detectDocumentKind(runtime), 'runtime');
assert.notEqual(convertDocument(runtime), runtime);
assert.deepEqual(targetFor(runtime, '', 0, 1).art, ['aB', ' c']);

const towerStudy = {
  meta: { canvasGlyphs: [2, 2], animation: '700 ms' },
  choices: { T1: { A: {} }, T2: {}, T3: {} },
  states: [
    { path: 'BASE', idleA: ['ab', ' c'], idleB: ['aB', ' c'] },
    { path: 'A', idleA: ['ab', ' c'], idleB: ['aB', ' c'] },
  ],
};
const convertedTower = convertTowerStudy(towerStudy, { filename: 'bolt-study.json', runtimeReference: runtime });
assert.equal(convertedTower.id, 'bolt');
assert.deepEqual(Object.keys(convertedTower.states).sort(), ['', '0']);
assert.equal(convertedTower.states[''].frames[0].art[0], 'aB');

const roadStudy = {
  id: 'road', cell: [2, 2], inkMap: { '.': null, a: 'road.mid' },
  tiers: { 0: { ...frame(), frames: [frame(['ba', ' c'])] } },
};
const convertedRoad = convertRoadStudy(roadStudy, { filename: 'road.json' });
assert.ok(convertedRoad.states['|']);
assert.equal(convertedRoad.states['|'].variations.length, 1);

const valid = validateSprite(runtime, {
  paletteRoles: { 'tower.frame': '#ffffff' },
  glyphCodepoints: ['a', 'b', 'B', 'c'].map((ch) => ch.codePointAt(0)),
});
assert.deepEqual(valid.errors, []);

const broken = structuredClone(runtime);
broken.states[''].art[0] = 'abc';
assert.match(validateSprite(broken).errors.join('\n'), /2 cells wide/);

const blank = makeFrame(3, 2);
assert.deepEqual(blank.art, ['   ', '   ']);
const withNewRole = structuredClone(runtime);
assert.equal(keyForRole(withNewRole, 'tower.new'), 'b');
assert.equal(withNewRole.inkMap.b, 'tower.new');
const crowded = structuredClone(runtime);
for (const key of 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') crowded.inkMap[key] = `role.${key}`;
assert.equal(keyForRole(crowded, 'gradient.extra').codePointAt(0), 0xe000);

const readProjectJson = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const palette = readProjectJson('packages/content/assets/palette.json');
const glyphset = readProjectJson('packages/app/public/assets/glyphset-spleen.json');
const projectGrid = readProjectJson('packages/content/assets/grid.json');
const towerSources = [
  ['bolt', 'ascii-defense-bolt-upgrade-tree-12.json'],
  ['mortar', 'ascii-defense-mortar-upgrade-tree-15.json'],
  ['frost', 'ascii-defense-frost-upgrade-tree-aligned-17.json'],
  ['refinery', 'ascii-defense-refinery-upgrade-tree-20.json'],
];
for (const [id, filename] of towerSources) {
  const study = readProjectJson(`sources/sprites/${filename}`);
  const reference = readProjectJson(`packages/content/assets/sprites/${id}.json`);
  const output = convertTowerStudy(study, { filename, runtimeReference: reference });
  const result = validateSprite(output, { paletteRoles: palette.roles, glyphCodepoints: glyphset.codepoints, expectedCell: projectGrid.cell });
  assert.deepEqual(result.errors, [], `${id} study conversion failed:\n${result.errors.join('\n')}`);
  assert.equal(Object.keys(output.states).length, 15);
}
const projectRoadStudy = readProjectJson('sources/sprites/ascii-defense-complete-road-sprites-31.json');
const roadOutput = convertRoadStudy(projectRoadStudy, { filename: 'ascii-defense-complete-road-sprites-31.json' });
const roadResult = validateSprite(roadOutput, { paletteRoles: palette.roles, glyphCodepoints: glyphset.codepoints, expectedCell: projectGrid.cell });
assert.deepEqual(roadResult.errors, [], roadResult.errors.join('\n'));
assert.equal(Object.keys(roadOutput.states).length, 12);

console.log('sprite-editor core: all tests passed');
