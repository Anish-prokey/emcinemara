/** Whether the opener should play. Kept out of the component file so that
 *  Ident.tsx exports a component and nothing else — a mixed export breaks
 *  React Fast Refresh for the whole module. */
const KEY = "filmi.identShown";

export function shouldPlayIdent(reduceMotion: boolean): boolean {
  if (reduceMotion) return false;
  if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return false;
  }
  try {
    return sessionStorage.getItem(KEY) !== "1";
  } catch {
    return true; // storage blocked — showing it once is harmless
  }
}

export function markIdentShown() {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    /* nothing to do */
  }
}
