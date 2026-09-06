/**
 * The painted study (session 27; docs/ART-AGENT.md sec 3 shape B): the
 * shape the art agent delivers imports through tools/import-sprites.mjs
 * with no rule to port. This runs the importer's painted path against a
 * fixture in a temp copy of the content tree and checks the sprite it
 * writes validates. The harness has no node types; the modules are
 * loaded by name and typed minimally here.
 */
import { describe, expect, it } from 'vitest';
import { validateSprite } from '@ascii-defense/content';

declare const process: { execPath: string; cwd(): string };

interface Fs {
  mkdtempSync(p: string): string;
  readFileSync(p: string, enc: string): string;
  writeFileSync(p: string, s: string): void;
  existsSync(p: string): boolean;
  mkdirSync(p: string, o: { recursive: boolean }): void;
  cpSync(a: string, b: string, o: { recursive: boolean }): void;
}
interface Cp {
  spawnSync(cmd: string, args: string[], o: { cwd: string; encoding: string }): { status: number | null; stdout: string; stderr: string };
}
const mod = async <T>(name: string): Promise<T> => (await import(/* @vite-ignore */ 'node:' + name)) as T;

describe('a painted study imports', () => {
  it('writes a relic sprite with roles named after the study, and refuses a wrong shape', { timeout: 20000 }, async () => {
    const fs = await mod<Fs>('fs');
    const cp = await mod<Cp>('child_process');
    const os = await mod<{ tmpdir(): string }>('os');
    const path = await mod<{ join(...p: string[]): string }>('path');
    const ROOT = process.cwd();
    if (!fs.existsSync(path.join(ROOT, 'tools', 'import-sprites.mjs'))) return; // not at the repo root
    // A throwaway copy of the repo's tools + sources + assets, so the real content is untouched.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ad-painted-'));
    for (const p of ['tools', 'sources/sprites', 'packages/content/assets']) {
      fs.mkdirSync(path.join(dir, p), { recursive: true });
      fs.cpSync(path.join(ROOT, p), path.join(dir, p), { recursive: true });
    }
    const study = {
      id: 'relic_probe',
      kind: 'relic',
      cell: [4, 3],
      frameMs: 200,
      palette: { gold: '#e6c55a' },
      inks: { '.': null, a: 'gold', d: 'ui.dim' },
      states: { '': { frames: [{ art: ['+--+', '|$$|', '+--+'], ink: ['dddd', 'daad', 'dddd'] }, { art: ['+--+', '|$ |', '+--+'], ink: ['dddd', 'da.d', 'dddd'] }] } },
    };
    fs.writeFileSync(path.join(dir, 'sources/sprites/relic_probe.study.json'), JSON.stringify(study));
    const r = cp.spawnSync(process.execPath, ['tools/import-sprites.mjs'], { cwd: dir, encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    const out = JSON.parse(fs.readFileSync(path.join(dir, 'packages/content/assets/sprites/relic_probe.json'), 'utf8')) as { kind: string; inkMap: Record<string, string>; states: Record<string, { frames: unknown[] }> };
    expect(validateSprite.check(out).ok).toBe(true);
    expect(out.kind).toBe('relic');
    expect(out.inkMap.a).toBe('relic.probe.gold');
    expect(out.states[''].frames.length).toBe(1);
    const palette = JSON.parse(fs.readFileSync(path.join(dir, 'packages/content/assets/palette.json'), 'utf8')) as { roles: Record<string, string> };
    expect(palette.roles['relic.probe.gold']).toBe('#e6c55a');
    // A wrong shape is refused with the file named.
    fs.writeFileSync(path.join(dir, 'sources/sprites/relic_bad.study.json'), JSON.stringify({ ...study, id: 'relic_bad', states: { '': { frames: [{ art: ['+--+', '|$$|'], ink: ['dddd', 'daad'] }] } } }));
    const bad = cp.spawnSync(process.execPath, ['tools/import-sprites.mjs'], { cwd: dir, encoding: 'utf8' });
    expect(bad.status).not.toBe(0);
    expect(bad.stderr + bad.stdout).toContain('relic_bad.study.json');
  });
});
