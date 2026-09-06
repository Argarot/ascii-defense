/**
 * The sim worker's SHELL (D7, session 18; lifecycle rebuilt 2.27 PR 4):
 * loads content, wires the runtime to postMessage and the tick interval.
 * Everything with behaviour lives in workerRuntime.ts, where it is
 * testable in Node - the shell only owns what a worker uniquely has:
 * globals and time.
 *
 * Worker timers are not throttled in hidden tabs, so the run keeps
 * simulating when the tab does not have the screen (D7's whole point); an
 * explicit pause is the only thing that stops time.
 */
import { validateEnemies, validateLoot, validateRecipes, validateRelics, validateSets, validateTowers } from '@ascii-defense/content';
import tileLibraryJson from '@ascii-defense/content/assets/tiles/library.json';
import enemiesJson from '@ascii-defense/content/assets/enemies/roster.json';
import towersJson from '@ascii-defense/content/assets/towers/roster.json';
import relicsJson from '@ascii-defense/content/assets/relics/pool.json';
import setsJson from '@ascii-defense/content/assets/sets/pool.json';
import recipesJson from '@ascii-defense/content/assets/recipes/pool.json';
import lootJson from '@ascii-defense/content/assets/loot/tables.json';
import type { FromWorker, ToWorker } from './protocol';
import { createWorkerRuntime } from './workerRuntime';

function must<T>(r: { ok: true; value: T } | { ok: false; errors: { path: string; message: string }[] }, what: string): T {
  if (!r.ok) throw new Error(`${what} failed validation`);
  return r.value;
}

const runtime = createWorkerRuntime({
  post: (m: FromWorker) => (globalThis as unknown as { postMessage(m: FromWorker): void }).postMessage(m),
  basics: tileLibraryJson.tiles,
  enemyDefs: must(validateEnemies.check(enemiesJson), 'enemies').enemies,
  towerDefs: must(validateTowers.check(towersJson), 'towers').towers,
  relicDefs: must(validateRelics.check(relicsJson), 'relics').relics,
  setDefs: must(validateSets.check(setsJson), 'sets').sets,
  recipeDefs: must(validateRecipes.check(recipesJson), 'recipes').recipes,
  lootTables: must(validateLoot.check(lootJson), 'loot').tables,
});

setInterval(() => runtime.beat(Date.now()), runtime.tickMs);

onmessage = (ev: MessageEvent<ToWorker>) => {
  runtime.handle(ev.data);
};
