import { MAX_GUESSES } from "./puzzle";

/**
 * A win in two and a win in ten currently produce the same celebration, which
 * wastes the best variable-reward lever the game has. Grades give the margin a
 * name, and the name is what people quote at each other.
 */
export type Grade = {
  title: string;
  blurb: string;
  /** 0-1, how big the celebration should be. Scales the fanfare and confetti. */
  reach: number;
};

// Blurbs never state the guess count: the line they appear in already does,
// and "Four guesses. Comfortable. Solved in 4 guesses." reads like a stutter.
const TIERS: { max: number; title: string; blurb: string }[] = [
  { max: 1, title: "One-take wonder", blurb: "No notes." },
  { max: 2, title: "Blockbuster", blurb: "Frightening." },
  { max: 3, title: "Superhit", blurb: "Clean work." },
  { max: 4, title: "Certified hit", blurb: "Comfortable." },
  { max: 6, title: "Clean release", blurb: "Solid." },
  { max: 8, title: "Close call", blurb: "That got interesting." },
  { max: 9, title: "Down to the wire", blurb: "Nerves of steel." },
  { max: MAX_GUESSES, title: "Saved in the edit", blurb: "Down to the final frame." },
];

export function gradeFor(guessesUsed: number): Grade {
  const t = TIERS.find((x) => guessesUsed <= x.max) ?? TIERS[TIERS.length - 1];
  return {
    title: t.title,
    blurb: t.blurb,
    // Ten guesses is the floor, one guess the ceiling.
    reach: Math.max(0.3, (MAX_GUESSES - guessesUsed + 1) / MAX_GUESSES),
  };
}

/** Streak lengths worth interrupting the celebration for. */
const MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];

export const isMilestone = (streak: number) => MILESTONES.includes(streak);

/** How far to the next one, for the nudge under the stats. */
export function nextMilestone(streak: number): number | null {
  return MILESTONES.find((m) => m > streak) ?? null;
}
