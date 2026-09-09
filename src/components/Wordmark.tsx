/**
 * The logotype.
 *
 * The name is Telugu — ఏం సినిమా రా, "what movie, man?" — which is the exact
 * question the game asks. Set as one run of ten capitals ("EMCINEMARA") that
 * reading is lost and it looks like a typo, so the three words stay separate
 * and the spacing is pulled in tight to keep it reading as a single mark.
 */
export default function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`wordmark whitespace-nowrap ${className}`} aria-label="Em Cinema Ra">
      <span aria-hidden>EM</span>
      <span aria-hidden className="ml-[0.14em]">
        CINEMA
      </span>
      <span aria-hidden className="ml-[0.14em]">
        RA
      </span>
    </span>
  );
}
