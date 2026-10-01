/**
 * Gradient helpers shared by both adapters and the Dart writer.
 *
 * Angles are CSS degrees: `0deg` points up and angles run clockwise, so
 * `90deg` runs left to right and `180deg` runs top to bottom.
 */

import type { GradientValue } from "./model"

const round = (value: number, places: number) => {
  const r = Number(value.toFixed(places))
  return Object.is(r, -0) ? 0 : r
}

/**
 * The CSS angle of a Supernova gradient from its `from` and `to` handles.
 *
 * The handles are fractions of the box, with y pointing down. This is the
 * formula `@supernovaio/export-helpers` `CSSHelper.gradientLayerToCSS` uses,
 * which is what web's `linear-gradient(156deg, …)` comes from. It is the
 * angle in box-fraction space, so it ignores the token's `aspectRatio`, as
 * web does. The helper can emit a negative angle; this one is 0–360.
 */
export function cssAngleFromHandles(from: { x: number; y: number }, to: { x: number; y: number }): number {
  const deg = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI
  return round((((deg + 90) % 360) + 360) % 360, 2)
}

/** `skinGradientBrandMainStop01` -> `skin-gradient-brand-main-stop-01`, as web's `toCssVarName`. */
export function keyToCssVar(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([a-zA-Z])([0-9])/g, "$1-$2")
    .toLowerCase()
}

/** A percent without float noise: `0.2` -> `20`. */
function percent(position: number): string {
  return `${round(position * 100, 2)}%`
}

/**
 * The CSS web ships for this gradient, with `var()` names in place of the
 * colours. Used for the generated doc comment, so a reader can match the Dart
 * field to `design-tokens.css`.
 */
export function cssForGradient(gradient: GradientValue): string {
  const stops = gradient.stops.map((stop) => {
    const color = stop.color.ref ? `var(--${keyToCssVar(stop.color.ref)})` : String(stop.color.literal)
    return `${color} ${percent(stop.position)}`
  })
  return `linear-gradient(${round(gradient.angle, 2)}deg, ${stops.join(", ")})`
}
