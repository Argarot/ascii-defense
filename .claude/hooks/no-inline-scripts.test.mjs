// Pipe-test the PreToolUse hook: each case is a Bash command and whether it must be denied. Run from the repo root.
import { spawnSync } from 'node:child_process';
const BS = String.fromCharCode(92);
const BT = String.fromCharCode(96);
const cases = [
  ['plain ls', 'ls -la', false],
  ['grep with an escaped pipe, no inline script', 'grep -n "a' + BS + '|b" file.ts', false],
  ['heredoc, clean body', "cat > x.txt <<'EOF'\nhello world\nEOF", false],
  ['heredoc with a backslash', "cat > x.mjs <<'EOF'\nconst r = /a" + BS + ".b/;\nEOF", true],
  ['heredoc with a backtick', "cat >> POSTMORTEM.md <<'EOF'\n- a " + BT + 'code' + BT + " span\nEOF", true],
  ['two heredocs, second one dirty', "cat > a <<'A'\nfine\nA\ncat > b <<'B'\nx" + BS + "n\nB", true],
  ['node -e clean', 'node -e "console.log(1)"', false],
  ['node -e with a backslash', 'node -e "console.log(' + "'a" + BS + "nb'" + ')"', true],
  ['python -c with a backtick', 'python3 -c "print(1)" ; echo ' + BT + 'date' + BT, true],
  ['a path that merely contains the word node', 'ls node_modules/.bin', false],
  ['garbage payload fails open', null, false],
];
let failed = 0;
for (const [name, command, deny] of cases) {
  const input = command === null ? 'not json' : JSON.stringify({ tool_name: 'Bash', tool_input: { command } });
  const r = spawnSync(process.execPath, ['.claude/hooks/no-inline-scripts.mjs'], { input, encoding: 'utf8' });
  const denied = r.stdout.includes('"permissionDecision":"deny"');
  const ok = denied === deny && r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${deny ? 'deny ' : 'allow'}  ${name}${ok ? '' : `  (exit ${r.status}, out: ${r.stdout.slice(0, 80)})`}`);
}
console.log(failed === 0 ? 'all cases pass' : `${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
