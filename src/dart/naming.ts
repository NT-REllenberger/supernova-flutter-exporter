/**
 * Dart names and literals for model tokens.
 *
 * Member names keep the web token name so a search for `buttonColorPrimaryHigh`
 * finds both platforms. One repeated leading word is dropped
 * (`radiusRadiusXs` -> `radiusXs`), because the Figma group and the token name
 * both start with it. `manifest.gen.json` records the full key for each member.
 */

import type { ModelToken } from "../model"

/** A semantic colour group: one generated data class and one StrataThemeData field. */
export interface ColorGroup {
  className: string
  field: string
  /** Key prefix, matched only at a word boundary (`field` + `Color…`). */
  prefix: string | null
}

/**
 * Component groups by key prefix. Anything else is a theme (`skin*`) token.
 * `indictor` is the Supernova spelling; the Dart class uses the real word.
 */
export const COLOR_GROUPS: ReadonlyArray<ColorGroup> = [
  { className: "TokenSemantic_Theme", field: "theme", prefix: null },
  { className: "TokenSemantic_Button", field: "button", prefix: "button" },
  { className: "TokenSemantic_Field", field: "field", prefix: "field" },
  { className: "TokenSemantic_Selector", field: "selector", prefix: "selector" },
  { className: "TokenSemantic_Status", field: "status", prefix: "status" },
  { className: "TokenSemantic_Feedback", field: "feedback", prefix: "feedback" },
  { className: "TokenSemantic_Indicator", field: "indicator", prefix: "indictor" },
]

export const CORE_COLOR_CLASS = "TokenCore_Color"
export const CORE_DENSITY_CLASS = "TokenCore_Density"
export const CORE_TYPOGRAPHY_CLASS = "TokenCore_Typography"
export const RADIUS_CLASS = "TokenSemanticDensity_Radius"
export const SPACING_CLASS = "TokenSemanticDensity_Spacing"
export const SIZE_CLASS = "TokenSemanticDensity_Size"
export const TYPOGRAPHY_CLASS = "TokenSemantic_Typography"
export const CORE_MOTION_CLASS = "TokenCore_Motion"
export const MOTION_CLASS = "TokenSemantic_Motion"
export const GRADIENT_CLASS = "TokenSemantic_Gradient"
export const THEME_DATA_CLASS = "StrataThemeData"

/** The package that bundles the fonts; `TextStyle.package` resolves against it. */
export const DART_PACKAGE = "mobile_strata"

export type DartType = "Color" | "double" | "int" | "String" | "TextStyle" | "Duration" | "Curve" | "LinearGradient"

const INT_TYPESCALE = /(FontWeight(Em)?|Liningfigures|Numerictabular|Standardligatures|Slashedzero)$/

export function dartTypeFor(token: ModelToken): DartType {
  switch (token.kind) {
    case "color":
      return "Color"
    case "typography":
      return "TextStyle"
    case "duration":
      return "Duration"
    case "easing":
      return "Curve"
    case "gradient":
      return "LinearGradient"
    case "typescale":
      if (typeof token.values.dark.literal === "string") return "String"
      return INT_TYPESCALE.test(token.key) ? "int" : "double"
    default:
      return "double"
  }
}

function startsWithWord(key: string, prefix: string): boolean {
  if (!key.startsWith(prefix)) return false
  const next = key.charAt(prefix.length)
  return next === "" || (next >= "A" && next <= "Z")
}

export function colorGroupFor(token: ModelToken): ColorGroup {
  return COLOR_GROUPS.find((g) => g.prefix && startsWithWord(token.key, g.prefix)) ?? COLOR_GROUPS[0]
}

/** Drop one repeated leading word: `radiusRadiusXs` -> `radiusXs`. */
export function dartMember(key: string): string {
  const match = /^([a-z]+)([A-Z][a-z]*)(.*)$/.exec(key)
  if (match && match[2].toLowerCase() === match[1] && match[3] !== "") {
    const rest = match[2] + match[3]
    return rest.charAt(0).toLowerCase() + rest.slice(1)
  }
  return key
}

/** The class a core token is emitted on. */
export function coreClassFor(token: ModelToken): string {
  if (token.kind === "color") return CORE_COLOR_CLASS
  if (token.kind === "typescale") return CORE_TYPOGRAPHY_CLASS
  if (token.kind === "duration" || token.kind === "easing") return CORE_MOTION_CLASS
  return CORE_DENSITY_CLASS
}

/**
 * Supernova easing labels, as web's compile-tokens maps them
 * (`SUPERNOVA_EASING_LABELS`, web-strata/scripts/compile-tokens/compile-tokens.utils.ts).
 * Keep the two tables in step.
 */
export const SUPERNOVA_EASING_LABELS: Record<string, string> = {
  "ease in and out": "ease-in-out",
  "ease in": "ease-in",
  "ease out": "ease-out",
}

export function normalizeTimingFunction(value: string): string {
  return SUPERNOVA_EASING_LABELS[value.toLowerCase()] ?? value
}

/** CSS timing-function keywords as Flutter curves, with CSS's exact control points. */
const CSS_CUBICS: Record<string, [number, number, number, number]> = {
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
}

/** `ease-in-out` -> `Cubic(0.42, 0.0, 0.58, 1.0)`; `cubic-bezier(a, b, c, d)` too. */
export function dartCurve(timing: string): string {
  const value = normalizeTimingFunction(timing.trim())
  if (value === "linear") return "Curves.linear"
  const bezier = /^cubic-bezier\(([^)]+)\)$/.exec(value)
  const points = bezier ? bezier[1].split(",").map((p) => Number(p.trim())) : CSS_CUBICS[value]
  if (!points || points.length !== 4 || points.some((p) => Number.isNaN(p))) {
    throw new Error(`Unsupported easing: ${timing}`)
  }
  return `Cubic(${points.map(dartDouble).join(", ")})`
}

/** `#rrggbb` or `#rrggbbaa` -> `Color(0xAARRGGBB)`. */
export function dartColor(literal: string): string {
  const hex = literal.replace(/^#/, "").toLowerCase()
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(hex)) {
    throw new Error(`Not a hex colour: ${literal}`)
  }
  const rgb = hex.slice(0, 6)
  const alpha = hex.length === 8 ? hex.slice(6, 8) : "ff"
  return `Color(0x${alpha}${rgb})`
}

/** A Dart double literal: `8` -> `8.0`. */
export function dartDouble(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : `${value}`
}

/** A single-quoted Dart string. */
export function dartString(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`
}

export function dartLiteral(token: ModelToken, literal: string | number): string {
  switch (dartTypeFor(token)) {
    case "Color":
      return dartColor(String(literal))
    case "String":
      return dartString(String(literal))
    case "int":
      return `${Math.round(Number(literal))}`
    case "Duration":
      return `Duration(milliseconds: ${Math.round(Number(literal))})`
    case "Curve":
      return dartCurve(String(literal))
    default:
      return dartDouble(Number(literal))
  }
}

const NAMED_ALIGNMENTS: Record<string, string> = {
  "-1,-1": "Alignment.topLeft",
  "0,-1": "Alignment.topCenter",
  "1,-1": "Alignment.topRight",
  "-1,0": "Alignment.centerLeft",
  "0,0": "Alignment.center",
  "1,0": "Alignment.centerRight",
  "-1,1": "Alignment.bottomLeft",
  "0,1": "Alignment.bottomCenter",
  "1,1": "Alignment.bottomRight",
}

function dartAlignment(x: number, y: number): string {
  const r = (n: number) => {
    const v = Number(n.toFixed(4))
    return Object.is(v, -0) ? 0 : v
  }
  const [rx, ry] = [r(x), r(y)]
  return NAMED_ALIGNMENTS[`${rx},${ry}`] ?? `Alignment(${dartDouble(rx)}, ${dartDouble(ry)})`
}

/**
 * A CSS `linear-gradient` angle as `LinearGradient` `begin` and `end`.
 *
 * CSS `0deg` points up and angles run clockwise, so the direction is
 * `(sin θ, -cos θ)` with y pointing down, as in Flutter. CSS makes the
 * gradient line long enough that the 0% and 100% lines pass through the
 * corners: `|W sin θ| + |H cos θ|`. The alignments are that direction scaled
 * by `k = |sin θ| + |cos θ|`, so on a square box the line matches CSS exactly
 * in angle and length. Axis angles (0, 90, 180, 270) match on every box.
 *
 * On a non-square box they differ. `Alignment` is a fraction of each side,
 * so Flutter's line stretches with the box: its angle in pixels is
 * `atan2(W sin θ, H cos θ)`, not θ, and its ends miss the corners. CSS keeps
 * θ fixed for every box. A 156deg gradient on a wide banner therefore runs
 * flatter in Flutter than on web. `GradientRotation` was rejected: it keeps
 * θ but leaves the line at the unrotated box width, so the stops compress
 * by up to 29% even on a square box.
 */
export function dartAlignments(angle: number): { begin: string; end: string } {
  const rad = (angle * Math.PI) / 180
  const [sin, cos] = [Math.sin(rad), Math.cos(rad)]
  const k = Math.abs(sin) + Math.abs(cos)
  return { begin: dartAlignment(-k * sin, k * cos), end: dartAlignment(k * sin, -k * cos) }
}

/** Brand slug -> class suffix: `nt` -> `NT`, `tdv` -> `TDV`. */
export function brandClass(slug: string): string {
  return `TokenSemanticTheme_Brand_${slug.toUpperCase()}`
}
