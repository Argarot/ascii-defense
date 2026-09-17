#!/usr/bin/env node
/**
 * PreToolUse hook on Bash: refuse a command that carries a SCRIPT inline - a
 * heredoc, or `node -e` / `python -c` - when that script contains a backslash
 * or a backtick.
 *
 * Why this exists (POSTMORTEM, 2026-09-17): the rule "never a backtick or a
 * backslash escape inside a shell string or a heredoc - write the script with
 * the Write tool and run it by path" was written down after the seventh
 * recurrence, stored as a memory after the eighth, and broken a ninth and a
 * tenth time in one evening with both loaded in context. One collapse turned
 * a regex's `\.` and `\d` into `.` and `d` inside shipped source, silently;
 * a test happened to catch it. Prose had a 0-for-10 record, so this is the
 * mechanism: the shortest path to a file is no longer the broken one.
 *
 * It reads the hook payload on stdin and answers with a permission decision.
 * It never blocks anything else - a plain `grep "a\|b"` has no inline script
 * and passes - and any error in here fails OPEN (exit 0, no decision), because
 * a broken guard must not take the shell away.
 */
import { readFileSync } from 'node:fs';

const REASON =
  'Inline script with a backslash or a backtick (CONTRIBUTING sec 5; POSTMORTEM 2026-09-17: ten recurrences). ' +
  'Shell layers collapse those escapes silently. Write the script or the text to the scratchpad with the Write tool ' +
  'and run it by path (node <file>, or cat <file> >> target, or gh ... --body-file <file>).';

function risky(text) {
  return text.includes('\\') || text.includes('`');
}

/** The bodies of every heredoc in a command: the lines between `<<WORD` and a line that is exactly WORD. */
function heredocBodies(command) {
  const bodies = [];
  const lines = command.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/.exec(lines[i]);
    if (!m) continue;
    const word = m[2];
    const body = [];
    let j = i + 1;
    for (; j < lines.length && lines[j].trim() !== word; j++) body.push(lines[j]);
    bodies.push(body.join('\n'));
    i = j;
  }
  return bodies;
}

try {
  const payload = JSON.parse(readFileSync(0, 'utf8'));
  const command = String(payload?.tool_input?.command ?? '');
  const inlineEval = /(^|[\s;&|(])(node|nodejs|python|python3|py|deno|bun)(\.exe)?\s+(-e|-c|--eval|-p|--print)\s/.test(command);
  const blocked = heredocBodies(command).some(risky) || (inlineEval && risky(command));
  if (blocked) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: REASON },
    }));
  }
} catch {
  // fail open
}
process.exit(0);
