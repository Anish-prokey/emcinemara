/**
 * Header icons as inline SVG rather than unicode glyphs.
 *
 * The previous set (? ▦ ▤ ⚙) leaned on box-drawing characters that render
 * inconsistently across platforms and are near-impossible to tell apart at
 * 36px — ▦ and ▤ differ by one line.
 */
const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const HelpIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.2 9.3a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.2-2.8 4" />
    <path d="M12 17.6h.01" />
  </svg>
);

export const ArchiveIcon = () => (
  <svg {...base}>
    <rect x="3" y="4.5" width="18" height="16" rx="2" />
    <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
  </svg>
);

export const StatsIcon = () => (
  <svg {...base}>
    <path d="M5 20V11M12 20V4M19 20v-6" />
  </svg>
);

export const SettingsIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 14.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.11a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.11a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9.5a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.11a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9.5a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.11a1.7 1.7 0 0 0-1.49 1z" />
  </svg>
);

export const SoundOnIcon = () => (
  <svg {...base}>
    <path d="M11 5 6 9H3v6h3l5 4z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);

export const SoundOffIcon = () => (
  <svg {...base}>
    <path d="M11 5 6 9H3v6h3l5 4z" />
    <path d="m16 9 5 6M21 9l-5 6" />
  </svg>
);

/** The streak flame. Filled rather than stroked so it reads at 14px. */
export const FlameIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2c.6 3.2-1.2 4.6-2.6 6C7.8 9.5 6 11 6 14a6 6 0 0 0 12 0c0-2.4-1-3.8-2-5.2-.3 1-.9 1.8-1.8 2.2.5-2.6-.6-6.4-2.2-9z" />
  </svg>
);
