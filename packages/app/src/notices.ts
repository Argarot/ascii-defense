/**
 * What a first-meeting banner SAYS (D41, 2026-09-18): the one line under the
 * name in the side panel. Pure and apart from main.ts so that a test can
 * hold every line the game can produce against the panel's width - the
 * first tower banner looked at in the running game was its whole
 * description, cut mid-sentence at "different sources stack: +".
 */
import { TRAIT_ANSWER } from '@ascii-defense/view';
import type { CODEX } from './generated/codex';

/** Wall-clock ms a banner stands while the run is running. */
export const NOTICE_MS = 9000;
/** The rows the panel gives a banner's line (HudPanel draws `wrap(line, W, 3)`). */
export const NOTICE_ROWS = 3;

/** An enemy's line: what answers its first trait, else what it is. */
export function enemyNoticeLine(e: (typeof CODEX.enemies)[number]): string {
  for (const t of e.traits) {
    const a = TRAIT_ANSWER[t.slice(0, t.indexOf(':'))];
    if (a) return a;
  }
  // No trait is not "nothing special" - the Juggernaut has none and 400 hp. Say what answers it: damage.
  return `no tricks: hp ${e.hp}, speed ${e.speed} - damage answers it`;
}

/** How many rows a line takes in a panel `w` glyphs wide, filled greedily the way HudPanel.wrap fills them. */
export function noticeRows(text: string, w: number): number {
  let n = 0;
  let line = '';
  for (const word of text.split(' ')) {
    if (line !== '' && (line + ' ' + word).length > w) { n++; line = word; }
    else line = line === '' ? word : line + ' ' + word;
  }
  return line === '' ? n : n + 1;
}

/**
 * A tower's line: the FIRST sentence of its description, and when that does
 * not fit the banner's rows (the Laser Lance's runs to six), the longest
 * run of its whole clauses that does. Never a cut: the card behind the
 * click has the rest.
 */
export function towerNoticeLine(c: (typeof CODEX.towers)[number], w = 30): string {
  const sentences = c.desc.replace(/\.$/, '').split('. ');
  /** The longest run of `text`'s whole clauses that fits the banner's rows after `lead`, or null. */
  const fit = (lead: string, text: string): string | null => {
    const cuts = [text.length, ...[...text.matchAll(/, |: |; | - /g)].map((m) => m.index ?? 0).reverse()];
    for (const at of cuts) if (noticeRows(lead + text.slice(0, at), w) <= NOTICE_ROWS) return lead + text.slice(0, at);
    return null;
  };
  const first = fit('', sentences[0]) ?? sentences[0]; // no clause fits: the test says so, and the description wants a shorter opening
  // An opening shorter than a row says what the tower is NOT ("Shoots nothing" - the Bastion): let the next sentence say what it is.
  if (first === sentences[0] && first.length < w - 6 && sentences[1]) return fit(`${first}. `, sentences[1]) ?? first;
  return first;
}

export const CHEST_NOTICE_LINE = 'select it and CLAIM - it sinks in twelve seconds';
export const BOON_NOTICE_LINE = 'a tower built on marked ground keeps its boon';
