import type { LangCode, Cert } from "./types";

/** The industries the game ships, one daily puzzle each. Order drives the picker. */
export const PLAYABLE: LangCode[] = ["hi", "ta", "te", "ml", "kn", "en"];

export const LANGS: Record<LangCode, { name: string; native: string; industry: string }> = {
  hi: { name: "Hindi", native: "हिन्दी", industry: "Bollywood" },
  ta: { name: "Tamil", native: "தமிழ்", industry: "Kollywood" },
  te: { name: "Telugu", native: "తెలుగు", industry: "Tollywood" },
  ml: { name: "Malayalam", native: "മലയാളം", industry: "Mollywood" },
  kn: { name: "Kannada", native: "ಕನ್ನಡ", industry: "Sandalwood" },
  // The other profiles show their own script on the tile; English has none to
  // show, and "English" again would just repeat the name printed under it.
  en: { name: "English", native: "EN", industry: "Hollywood" },
};

export const langName = (c: LangCode) => LANGS[c]?.name ?? c;

export const isPlayable = (c: string): c is LangCode =>
  PLAYABLE.includes(c as LangCode);

/**
 * Certificate scales, each ordered so "adjacent" can count as a near-miss.
 *
 * Indian films carry CBFC certificates. English films use the US (MPA) scale
 * instead: TMDB has an MPA rating for nearly every well-known Hollywood film but
 * a CBFC certificate for only about half of them, which would leave the clue
 * blank on most English days. A puzzle only ever compares films from one
 * industry, so the two scales never meet.
 */
export const CERT_SCALES: Cert[][] = [
  ["U", "UA", "A"],
  ["G", "PG", "PG13", "R", "NC17"],
];

export const CERT_LABEL: Record<Cert, string> = {
  U: "U",
  UA: "U/A",
  A: "A",
  G: "G",
  PG: "PG",
  PG13: "PG-13",
  R: "R",
  NC17: "NC-17",
  NR: "NR",
};

/** What the certificate tile is called, and what it means, in an industry. */
export function certClue(lang: LangCode): { label: string; help: string } {
  return lang === "en"
    ? { label: "US rating", help: "US (MPA) rating: G, PG, PG-13, R or NC-17. Gold = one step away." }
    : { label: "Certificate", help: "CBFC certificate: U, U/A or A. Gold = one step away." };
}
