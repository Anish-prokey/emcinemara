/**
 * What each clue actually means, in one place, so the explainer modal, the
 * legend and the per-tile tooltips can never drift apart.
 * Keys match the tile labels exactly.
 */
export const CLUE_HELP: Record<string, string> = {
  Year: "Release year. Gold = within 5 years. The arrow points at the answer: up is later, down is earlier.",
  Rating: "TMDB user rating out of 10. Gold = within 0.4. The arrow points at the answer.",
  Certificate: "CBFC certificate: U, U/A or A. Gold = one step away.",
  Runtime: "How long the film runs. Gold = within 10 minutes. The arrow points at the answer.",
  Director: "Green = same director. Gold = that person is credited on the answer in some other role.",
  Music: "The music director. Green = the same person. Gold = they are credited on the answer some other way.",
  Cast: "Green = the same actor billed in the same position. Gold = they are in the answer's cast, just elsewhere.",
  Genres: "Each genre turns green if the answer shares it.",
};
