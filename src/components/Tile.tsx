import type { ReactNode } from "react";
import type { TileState, Arrow } from "../lib/types";

export function stateClass(state: TileState): string {
  switch (state) {
    case "hit":
      return "bg-[var(--color-hit)] border-[var(--color-hit-2)] text-white";
    case "near":
      return "bg-[var(--color-near)] border-[var(--color-near-2)] text-[#1b1403]";
    default:
      return "bg-[var(--color-miss)] border-[var(--color-line)] text-[var(--color-fg)]/70";
  }
}

function ArrowMark({ dir }: { dir: Arrow }) {
  if (!dir) return null;
  return (
    <span aria-label={dir === "up" ? "higher" : "lower"} className="ml-1 inline-block text-[0.9em] leading-none opacity-90">
      {dir === "up" ? "▲" : "▼"}
    </span>
  );
}

type Props = {
  label: string;
  value: ReactNode;
  state: TileState;
  arrow?: Arrow;
  delay?: number;
  animate?: boolean;
  wide?: boolean;
  title?: string;
};

export default function Tile({ label, value, state, arrow, delay = 0, animate = true, wide, title }: Props) {
  return (
    <div
      className={`${wide ? "col-span-2" : ""} ${animate ? "tile-flip" : ""} rounded border px-2 py-1.5 sm:px-2.5 sm:py-2 ${stateClass(state)}`}
      style={animate ? { animationDelay: `${delay}ms` } : undefined}
      title={title}
    >
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] opacity-70 sm:text-[10px]">
        {label}
      </div>
      <div className="mt-0.5 flex items-center truncate text-[13px] leading-tight font-medium sm:text-sm">
        <span className="truncate">{value}</span>
        <ArrowMark dir={arrow ?? null} />
      </div>
    </div>
  );
}
