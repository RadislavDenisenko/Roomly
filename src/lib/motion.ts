// Shared reduced-motion check for interactions that are driven from JS
// (e.g. a setTimeout gating a CSS animation), not just plain CSS/Tailwind
// classes — those are already covered by the `@media (prefers-reduced-motion)`
// rules in globals.css.
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
