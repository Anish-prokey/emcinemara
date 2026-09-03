import type { LangCode, Cert } from "./types";

/** The five industries the game ships. Order drives the picker. */
export const PLAYABLE: LangCode[] = ["hi", "ta", "te", "ml", "kn"];

export const LANGS: Record<LangCode, { name: string; native: string; industry: string }> = {
  hi: { name: "Hindi", native: "हिन्दी", industry: "Bollywood" },
  ta: { name: "Tamil", native: "தமிழ்", industry: "Kollywood" },
  te: { name: "Telugu", native: "తెలుగు", industry: "Tollywood" },
  ml: { name: "Malayalam", native: "മലയാളം", industry: "Mollywood" },
  kn: { name: "Kannada", native: "ಕನ್ನಡ", industry: "Sandalwood" },
};

export const langName = (c: LangCode) => LANGS[c]?.name ?? c;

export const isPlayable = (c: string): c is LangCode =>
  PLAYABLE.includes(c as LangCode);

/** CBFC certificates, ordered so "adjacent" can count as a near-miss. */
export const CERT_ORDER: Cert[] = ["U", "UA", "A"];
export const CERT_LABEL: Record<Cert, string> = {
  U: "U",
  UA: "U/A",
  A: "A",
  NR: "NR",
};
