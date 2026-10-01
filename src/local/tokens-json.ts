/**
 * Local adapter: builds the token model from the web exporter's tokens.json.
 *
 * This lets the Dart side develop against real Strata values without a
 * Supernova run. It is a stand-in, not the source of truth: tokens.json has
 * already lost some structure, so three things here are heuristics that the
 * SDK adapter does properly.
 *
 * 1. Layer. tokens.json groups by type, not collection. A colour is core when
 *    its only value is a literal and its key has no semantic prefix.
 * 2. Brand overlays are literals. A brand value that differs from the base is
 *    mapped back to a core colour when exactly one core colour has that value.
 * 3. Semantic density (T-shirt sizes) was flattened to px. Each is mapped to
 *    the first core scale token with the same value.
 *
 * Gradients are CSS strings in the `gradient` collection, such as
 * `linear-gradient(156deg, var(--skin-gradient-brand-main-stop-01, #ff4200) 20%, …)`.
 * They are parsed back to angle and stops. Each stop keeps its `var()` name
 * as the colour reference, so the brand and mode come from that colour.
 */

import { GradientValue, Kind, Layer, ModeValues, ModelToken, TokenModel, Value } from "../model"
import { normalizeTimingFunction } from "../dart/naming"
import { typographyTokens } from "../typography"

interface JsonToken {
  type: string
  default?: string
  dark?: string
  light?: string
}

type JsonCollection = Record<string, JsonToken>

export interface TokensJson {
  collections: Record<string, JsonCollection>
  brands?: Record<string, Record<string, JsonCollection>>
}

const SEMANTIC_COLOR_PREFIX = /^(skin|button|field|selector|status|feedback|indictor)(?=[A-Z]|$)/
const TSHIRT_SIZE = /(3xs|Xxs|Xs|Sm|M|Lg|Xl|Xxl|[0-9]xl)$/

/** Mirrors the web exporter's `toCssVarName`, run in reverse. */
export function cssVarToKey(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
}

function toHex2(n: number): string {
  return Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0")
}

/** `#rgb`, `#rrggbb`, `#rrggbbaa`, or `rgba(r, g, b, a)` -> `#rrggbbaa`. */
export function normalizeColor(raw: string): string {
  const value = raw.trim().toLowerCase()
  const rgba = /^rgba?\(([^)]+)\)$/.exec(value)
  if (rgba) {
    const [r, g, b, a = "1"] = rgba[1].split(",").map((p) => p.trim())
    return `#${toHex2(+r)}${toHex2(+g)}${toHex2(+b)}${toHex2(+a * 255)}`
  }
  const hex = value.replace(/^#/, "")
  if (/^[0-9a-f]{3}$/.test(hex)) return `#${hex.split("").map((c) => c + c).join("")}ff`
  if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}ff`
  if (/^[0-9a-f]{8}$/.test(hex)) return `#${hex}`
  throw new Error(`Unrecognised colour: ${raw}`)
}

/** `var(--name, literal)` or a bare literal. */
export function parseColorValue(raw: string): Value {
  const match = /^var\(--([a-z0-9-]+),\s*(.+)\)$/.exec(raw.trim())
  if (match) return { literal: normalizeColor(match[2]), ref: cssVarToKey(match[1]) }
  return { literal: normalizeColor(raw) }
}

function parsePx(raw: string): number {
  const match = /^(-?[0-9.]+)px$/.exec(raw.trim())
  if (!match) throw new Error(`Not a px value: ${raw}`)
  return Number(match[1])
}

function modeValues(json: JsonToken, parse: (raw: string) => Value): ModeValues {
  const dark = json.dark ?? json.default
  if (dark === undefined) throw new Error("token has no dark or default value")
  return { dark: parse(dark), light: parse(json.light ?? dark) }
}

function colorTokens(json: TokensJson): ModelToken[] {
  return Object.entries(json.collections.color ?? {}).map(([key, value]) => {
    const values = modeValues(value, parseColorValue)
    const isLiteralOnly = value.default !== undefined && !values.dark.ref
    const layer: Layer = isLiteralOnly && !SEMANTIC_COLOR_PREFIX.test(key) ? "core" : "semantic"
    return { key, sourceId: key, kind: "color", layer, collection: "tokens.json:color", values, brandOverrides: {} }
  })
}

function densityTokens(json: TokensJson, collection: string, prefix: string, kind: Kind): ModelToken[] {
  const entries = Object.entries(json.collections[collection] ?? {}).filter(([key]) => key.startsWith(prefix))
  const tokens: ModelToken[] = entries.map(([key, value]) => {
    const px = parsePx(value.default ?? value.dark ?? "")
    return {
      key,
      sourceId: key,
      kind,
      layer: TSHIRT_SIZE.test(key) ? "semantic" : "core",
      collection: `tokens.json:${collection}`,
      values: { dark: { literal: px }, light: { literal: px } },
      brandOverrides: {},
    }
  })
  const core = tokens.filter((t) => t.layer === "core")
  for (const token of tokens.filter((t) => t.layer === "semantic")) {
    const target = core.find((c) => c.values.dark.literal === token.values.dark.literal)
    if (target) {
      const ref: Value = { literal: token.values.dark.literal, ref: target.key }
      token.values = { dark: ref, light: ref }
    }
  }
  return tokens
}

function brandOverrides(json: TokensJson, colors: ModelToken[], notes: string[]): string[] {
  const brands = Object.keys(json.brands ?? {}).sort()
  const byKey = new Map(colors.map((t) => [t.key, t]))
  const coreByLiteral = new Map<string, ModelToken[]>()
  for (const core of colors.filter((t) => t.layer === "core")) {
    const literal = String(core.values.dark.literal)
    coreByLiteral.set(literal, [...(coreByLiteral.get(literal) ?? []), core])
  }
  const resolvedLiteral = (token: ModelToken, value: Value): string => {
    let current: ModelToken | undefined = token
    let v = value
    const seen = new Set<string>()
    while (v.ref && (current = byKey.get(v.ref)) && !seen.has(current.key)) {
      seen.add(current.key)
      v = current.values.dark
    }
    return String(v.literal)
  }

  for (const brand of brands) {
    let count = 0
    for (const [key, entry] of Object.entries(json.brands?.[brand]?.color ?? {})) {
      const token = byKey.get(key)
      if (!token) continue
      const brandValues = modeValues(entry, parseColorValue)
      const override: Partial<ModeValues> = {}
      for (const mode of ["dark", "light"] as const) {
        const base = token.values[mode]
        const literal = String(brandValues[mode].literal)
        if (literal === String(base.literal) || literal === resolvedLiteral(token, base)) continue
        const matches = coreByLiteral.get(literal) ?? []
        override[mode] = matches.length === 1 ? { literal, ref: matches[0].key } : { literal }
        if (matches.length !== 1) notes.push(`brand ${brand}: ${key} ${mode} has ${matches.length} core matches`)
      }
      if (override.dark || override.light) {
        token.brandOverrides[brand] = override
        count += 1
      }
    }
    notes.push(`brand ${brand}: ${count} overridden colour token(s) (local heuristic)`)
  }
  return brands
}

/** Component sizes (button and field heights). Literal-only, so core. */
function sizeTokens(json: TokensJson): ModelToken[] {
  return Object.entries(json.collections.size ?? {}).map(([key, value]) => {
    const px = parsePx(value.default ?? value.dark ?? "")
    return {
      key,
      sourceId: key,
      kind: "size",
      layer: "core",
      collection: "tokens.json:size",
      values: { dark: { literal: px }, light: { literal: px } },
      brandOverrides: {},
    }
  })
}

const TYPESCALE_COLLECTIONS = ["dimension", "fontSize", "lineHeight", "letterSpacing", "fontFamily"]

/** `'14px'` -> 14, `'0.01em'` -> 0.01, `'1.1429'` -> 1.1429, `'"Geist Mono"'` -> `'Geist Mono'`. */
export function parseTypescale(raw: string): string | number {
  const value = raw.trim()
  const number = /^(-?[0-9.]+)(px|em)?$/.exec(value)
  if (number) return Number(number[1])
  return value.replace(/^"(.*)"$/, "$1")
}

function typescaleTokens(json: TokensJson): ModelToken[] {
  return TYPESCALE_COLLECTIONS.flatMap((collection) =>
    Object.entries(json.collections[collection] ?? {})
      .filter(([key]) => key.startsWith("typescale"))
      .map(([key, value]): ModelToken => {
        const literal = parseTypescale(value.default ?? value.dark ?? "")
        return {
          key,
          sourceId: key,
          kind: "typescale",
          layer: "core",
          collection: `tokens.json:${collection}`,
          values: { dark: { literal }, light: { literal } },
          brandOverrides: {},
        }
      }),
  )
}

/** Durations (`'50ms'`) and easing labels (`'ease in and out'`). Core only. */
function motionTokens(json: TokensJson): ModelToken[] {
  const token = (key: string, kind: Kind, literal: string | number, collection: string): ModelToken => ({
    key,
    sourceId: key,
    kind,
    layer: "core",
    collection: `tokens.json:${collection}`,
    values: { dark: { literal }, light: { literal } },
    brandOverrides: {},
  })
  const durations = Object.entries(json.collections.other ?? {})
    .filter(([key]) => key.startsWith("duration"))
    .map(([key, value]) => {
      const match = /^(\d+(?:\.\d+)?)ms$/.exec((value.default ?? "").trim())
      if (!match) throw new Error(`Not a ms duration: ${key}=${value.default}`)
      return token(key, "duration", Number(match[1]), "other")
    })
  const easings = Object.entries(json.collections.string ?? {})
    .filter(([key]) => key.startsWith("easing"))
    .map(([key, value]) => token(key, "easing", normalizeTimingFunction(value.default ?? ""), "string"))
  return [...durations, ...easings]
}

/** Split on commas that are not inside parentheses. */
function splitTopLevel(value: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < value.length; i++) {
    const c = value[i]
    if (c === "(") depth += 1
    else if (c === ")") depth -= 1
    else if (c === "," && depth === 0) {
      parts.push(value.slice(start, i).trim())
      start = i + 1
    }
  }
  parts.push(value.slice(start).trim())
  return parts
}

const SIDE_ANGLES: Record<string, number> = { "to top": 0, "to right": 90, "to bottom": 180, "to left": 270 }

/**
 * `linear-gradient(156deg, var(--a, #ff4200) 20%, var(--b, #ed35fe) 100%)` as
 * a model gradient. Throws on what Flutter's model cannot hold: another
 * gradient function, a corner keyword (`to top right` depends on the box), a
 * non-degree angle unit, or a stop without a position.
 */
export function parseLinearGradient(raw: string): GradientValue {
  const match = /^linear-gradient\((.*)\)$/s.exec(raw.trim())
  if (!match) throw new Error(`not a linear-gradient: ${raw}`)
  const [first, ...rest] = splitTopLevel(match[1])
  const degrees = /^(-?[0-9.]+)deg$/.exec(first)
  let angle: number
  let stopParts = rest
  if (degrees) angle = Number(degrees[1])
  else if (first in SIDE_ANGLES) angle = SIDE_ANGLES[first]
  else if (/^to /.test(first) || /^-?[0-9.]+(rad|grad|turn)$/.test(first)) throw new Error(`unsupported gradient direction: ${first}`)
  else {
    angle = 180 // CSS default: to bottom.
    stopParts = [first, ...rest]
  }
  const stops = stopParts.map((part) => {
    const stop = /^(.*\S)\s+(-?[0-9.]+)%$/s.exec(part)
    if (!stop) throw new Error(`gradient stop has no percent position: ${part}`)
    return { color: parseColorValue(stop[1]), position: Number(stop[2]) / 100 }
  })
  return { type: "linear", angle: ((angle % 360) + 360) % 360, stops }
}

function gradientTokens(json: TokensJson, brands: string[], notes: string[]): ModelToken[] {
  const tokens: ModelToken[] = []
  const parse = (key: string, raw: string | undefined): GradientValue | null => {
    if (raw === undefined) return null
    try {
      return parseLinearGradient(raw)
    } catch (error) {
      notes.push(`gradient ${key}: ${(error as Error).message}; skipped`)
      return null
    }
  }
  for (const [key, entry] of Object.entries(json.collections.gradient ?? {})) {
    const dark = parse(key, entry.dark ?? entry.default)
    if (!dark) continue
    const light = parse(key, entry.light) ?? dark
    const brandOverrides: Record<string, { dark?: GradientValue; light?: GradientValue }> = {}
    for (const brand of brands) {
      const override = json.brands?.[brand]?.gradient?.[key]
      if (!override) continue
      const d = parse(key, override.dark ?? override.default)
      const l = parse(key, override.light) ?? d
      if (d || l) brandOverrides[brand] = { ...(d && { dark: d }), ...(l && { light: l }) }
    }
    tokens.push({
      key,
      sourceId: key,
      kind: "gradient",
      layer: "semantic",
      collection: "tokens.json:gradient",
      values: { dark: { literal: "" }, light: { literal: "" } },
      brandOverrides: {},
      gradient: { values: { dark, light }, brandOverrides },
    })
  }
  return tokens
}

export function modelFromTokensJson(json: TokensJson): TokenModel {
  const notes: string[] = ["source: tokens.json (local adapter; layers and brand refs are heuristic)"]
  const colors = colorTokens(json)
  const typescale = typescaleTokens(json)
  const styles = Object.keys(json.collections.typography ?? {}).map((key) => ({
    key,
    sourceId: key,
    collection: "tokens.json:typography",
  }))
  const tokens = [
    ...colors,
    ...densityTokens(json, "borderRadius", "radius", "radius"),
    ...densityTokens(json, "dimension", "spacing", "spacing"),
    ...sizeTokens(json),
    ...typescale,
    ...typographyTokens(styles, typescale, notes),
    ...motionTokens(json),
  ]
  const brands = brandOverrides(json, colors, notes)
  tokens.push(...gradientTokens(json, brands, notes))
  return { brands, tokens, notes }
}
