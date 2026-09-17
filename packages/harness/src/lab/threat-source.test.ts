/**
 * One source for the Threat levels (session 36, PR 5). The sweeps used to
 * carry hand copies of the curve "as protocol.ts ships it" because the
 * harness may not import the app; seven copies in six files, and one of
 * them measured x1.05 and four a wave for two sessions after the game moved
 * to x1.07 and five. The table lives in the engine now, and this is the
 * mechanism that keeps a copy from growing back: a sweep that spells a
 * curve out by hand fails here, by file and line.
 */
import { describe, expect, it } from 'vitest';
import { THREAT_LEVELS } from '@ascii-defense/engine';

/** Every source file of the lab, as text (the harness has no node types; Vite's raw glob is how its tests read files). */
const SOURCES = import.meta.glob(['./*.ts'], { query: '?raw', import: 'default', eager: true });

describe('the lab measures the world the game ships', () => {
  it('no sweep spells a Threat curve or a Threat knob out by hand', () => {
    const offenders: string[] = [];
    for (const [path, text] of Object.entries(SOURCES)) {
      if (path.endsWith('threat-source.test.ts')) continue;
      text.split('\n').forEach((line: string, i: number) => {
        // A difficulty literal (hpGeometric: 1.0x) or a knob literal (pathBias: n / entries: [a, b]) is a copy of the engine's table.
        if (/hpGeometric:\s*\d|pathBias:\s*\d|entries:\s*\[\s*\d/.test(line)) offenders.push(`${path}:${i + 1}: ${line.trim().slice(0, 100)}`);
      });
    }
    expect(Object.keys(SOURCES).length).toBeGreaterThan(5); // the glob found the lab, or this test proves nothing
    expect(offenders, 'read THREAT_LEVELS / threatKnobs from the engine instead').toEqual([]);
  });

  it('the table is the three levels the setup page offers, each harder than the last', () => {
    expect(THREAT_LEVELS.map((t) => t.name)).toEqual(['Calm', 'Standard', 'Grim']);
    for (let i = 1; i < THREAT_LEVELS.length; i++) {
      const a = THREAT_LEVELS[i - 1], b = THREAT_LEVELS[i];
      expect(b.difficulty.hpGeometric, b.name).toBeGreaterThan(a.difficulty.hpGeometric ?? 0);
      expect(b.pathBias, b.name).toBeLessThan(a.pathBias); // shorter roads
      expect(b.waveSeconds, b.name).toBeLessThan(a.waveSeconds); // a faster clock
      expect(b.finalWave, b.name).toBeGreaterThan(a.finalWave); // a longer run
    }
  });
});
