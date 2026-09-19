/**
 * Gradient fill for a field's box — pure helpers shared by the Studio editor, the domain
 * mappers (validating what the database hands back) and both renderer paths.
 *
 * `angle` follows CSS: 0° paints bottom→top, 90° left→right, 180° top→bottom. Stops are
 * spread evenly along that line, in the order given (2 to 7 colours).
 */

export interface BoxGradient {
  angle: number;
  /** 2–7 hex colours, first to last along the angle. */
  stops: string[];
}

export const MIN_GRADIENT_STOPS = 2;
export const MAX_GRADIENT_STOPS = 7;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function isHexColor(value: string): boolean {
  return HEX.test(value.trim());
}

/**
 * Accepts whatever the database, a seed or a form produced and returns a clean gradient,
 * or null when it is not usable (too few stops, a non-hex colour, garbage JSON).
 */
export function normalizeBoxGradient(value: unknown): BoxGradient | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { angle?: unknown; stops?: unknown };
  if (!Array.isArray(raw.stops)) return null;
  const stops = raw.stops
    .filter((s): s is string => typeof s === "string" && isHexColor(s))
    .map((s) => s.trim().toLowerCase())
    .slice(0, MAX_GRADIENT_STOPS);
  if (stops.length < MIN_GRADIENT_STOPS) return null;
  const angle = typeof raw.angle === "number" && Number.isFinite(raw.angle) ? ((raw.angle % 360) + 360) % 360 : 180;
  return { angle: Math.round(angle * 100) / 100, stops };
}

/** The CSS `background-image` value — the single way a gradient is ever painted. */
export function boxGradientCss(gradient: BoxGradient): string {
  return `linear-gradient(${gradient.angle}deg, ${gradient.stops.join(", ")})`;
}

/** Moves one stop to a new index (drag, or the keyboard up/down buttons). */
export function moveGradientStop(stops: readonly string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= stops.length || to >= stops.length) return [...stops];
  const next = [...stops];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}
