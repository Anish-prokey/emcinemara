import type { LangCode } from "./types";

/**
 * Profile-avatar looks, shared by the picker, the header and Settings so the
 * industries are recognisable by colour anywhere they appear.
 *
 * `size` is set per language because the scripts are wildly different widths at
 * the same font size — Malayalam runs roughly three times as wide as Devanagari,
 * so a single value overflows the tile for some and looks lost for others.
 */
export const PROFILE: Record<LangCode, { tint: string; size: string }> = {
  hi: { tint: "linear-gradient(150deg,#e50914,#7a0409)", size: "1.65rem" },
  ta: { tint: "linear-gradient(150deg,#0f7b6c,#053b34)", size: "1.45rem" },
  te: { tint: "linear-gradient(150deg,#2f5fd0,#132a63)", size: "1.35rem" },
  ml: { tint: "linear-gradient(150deg,#c8850f,#5d3c04)", size: "1.05rem" },
  kn: { tint: "linear-gradient(150deg,#7b3fbf,#33165c)", size: "1.45rem" },
  en: { tint: "linear-gradient(150deg,#b8326e,#4a0f2b)", size: "2rem" },
};
