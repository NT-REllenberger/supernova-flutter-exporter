/**
 * Platform-neutral token model.
 *
 * Both adapters produce it: `sdk/` from live Supernova data and `local/` from
 * the web exporter's tokens.json. The Dart writer consumes it. Keeping the
 * writer behind this model lets one writer serve both sources, and lets tests
 * build a model by hand without SDK class instances.
 */

export type Layer = "core" | "semantic"

/**
 * `typescale` is a core typography primitive (a size, line height, tracking,
 * weight, family, or font-feature flag). `typography` is a semantic text
 * style built from them; its fields live on `ModelToken.typeStyle`.
 */
export type Kind =
  | "color"
  | "radius"
  | "spacing"
  | "size"
  | "typescale"
  | "typography"
  /** Milliseconds. */
  | "duration"
  /** A CSS timing-function keyword or `cubic-bezier(…)`, as web compiles it. */
  | "easing"
  /** A linear gradient. Its fields live on `ModelToken.gradient`. */
  | "gradient"

export type Mode = "dark" | "light"

export const MODES: ReadonlyArray<Mode> = ["dark", "light"]

/**
 * One resolved value. `literal` is always present so a broken reference can
 * degrade to it. `ref` is the `key` of the token this value aliases.
 *
 * Colours are `#rrggbbaa`. Radius and spacing are pixels.
 */
export interface Value {
  literal: string | number
  ref?: string
}

export interface ModeValues {
  dark: Value
  light: Value
}

/**
 * A semantic text style. Every field is a Value, so each can reference the
 * core `typescale` token it came from. Tracking is in em; line height is a
 * ratio of the font size, as on web.
 */
export interface TypeStyle {
  family: Value
  size: Value
  lineHeight: Value
  tracking: Value
  weight: Value
  lnum: Value
  tnum: Value
  liga: Value
  zero: Value
  underline: boolean
}

/**
 * One gradient stop. `color.ref` is the key of the colour token the stop
 * reads, so the brand and mode come from that colour. `color.literal` is the
 * fallback. `position` is 0–1, as CSS percent / 100.
 */
export interface GradientStop {
  color: Value
  position: number
}

/**
 * A CSS `linear-gradient`. `angle` is CSS degrees: `0` points up and angles
 * run clockwise. Only linear gradients are modelled; the adapters report and
 * skip the other types.
 */
export interface GradientValue {
  type: "linear"
  angle: number
  stops: GradientStop[]
}

export interface GradientModes {
  dark: GradientValue
  light: GradientValue
}

/** Gradient values with the same mode and brand cascade as `values`. */
export interface GradientSet {
  values: GradientModes
  brandOverrides: Record<string, Partial<GradientModes>>
}

export interface ModelToken {
  /** Stable name shared with web: camelCase group path plus token name. */
  key: string
  /** Supernova persistent token id, or the key when the source has none. */
  sourceId: string
  kind: Kind
  layer: Layer
  /** Supernova collection name, for the manifest and reports. */
  collection: string
  /** Base (root collection) values. */
  values: ModeValues
  /** Per-brand overrides. A missing mode falls back to `values`. */
  brandOverrides: Record<string, Partial<ModeValues>>
  /** Set only for `kind: "typography"`. Its `values` are unused. */
  typeStyle?: TypeStyle
  /** Set only for `kind: "gradient"`. Its `values` are unused. */
  gradient?: GradientSet
}

export interface TokenModel {
  /** Brand slugs, e.g. `nt`, `tdv`. Every brand gets a full theme file. */
  brands: string[]
  tokens: ModelToken[]
  /** Lines worth surfacing in the export log. Never fatal. */
  notes: string[]
}

/** The value a brand sees for a token in one mode. */
export function valueFor(token: ModelToken, brand: string, mode: Mode): Value {
  return token.brandOverrides[brand]?.[mode] ?? token.values[mode]
}

/** The gradient a brand sees in one mode. */
export function gradientFor(set: GradientSet, brand: string, mode: Mode): GradientValue {
  return set.brandOverrides[brand]?.[mode] ?? set.values[mode]
}
