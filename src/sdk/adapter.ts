/**
 * SDK adapter: builds the token model from live Supernova data.
 *
 * Follows supernova-web-exporter so both platforms read Strata the same way,
 * with one fix: `token.collectionId` is the collection *persistentId*, so the
 * lookup keys on it. Web keys on `col.id` and falls back to type names
 * (see its NOTES.md, 2026-08-20).
 *
 * Mode cascade matches the CSS web ships. The token's own value is the dark
 * default. Root theme overrides replace it per mode; a dark-only override
 * applies to light too. Brand overrides replace the root per mode.
 *
 * Gradients follow the same cascade. Each stop keeps the id of the colour it
 * reads, so a stop's brand and mode normally come from that colour, not from
 * a gradient override.
 */

import type {
  ColorToken,
  ColorTokenValue,
  DesignSystemCollection,
  DimensionToken,
  GradientToken,
  RadiusToken,
  Token,
  TokenGroup,
  TokenTheme,
} from "@supernovaio/sdk-exporters"

import { GradientModes, GradientValue, Kind, Layer, ModeValues, ModelToken, TokenModel, Value } from "../model"
import { normalizeTimingFunction } from "../dart/naming"
import { cssAngleFromHandles } from "../gradient"
import { typographyTokens } from "../typography"
import { buildGroupsById, buildTokenName } from "./naming"
import { DEFAULT_THEME_NAMES, ThemeNames, discoverBrands, findRootTheme } from "./themes"

export interface SdkInput {
  tokens: Token[]
  groups: TokenGroup[]
  themes: TokenTheme[]
  collections: DesignSystemCollection[]
  themeNames?: ThemeNames
}

const TYPESCALE_TYPES = new Set(["FontSize", "LineHeight", "LetterSpacing", "FontFamily", "Dimension"])

/** Token types are compared as strings so tests need no SDK enum at runtime. */
function kindOf(token: Token, key: string): Kind | null {
  const type = String(token.tokenType)
  if (type === "Color") return "color"
  if (type === "BorderRadius") return "radius"
  if (type === "Size") return "size"
  if (key.startsWith("typescale") && TYPESCALE_TYPES.has(type)) return "typescale"
  if (type === "Typography") return "typography"
  if (type === "Duration") return "duration"
  if (type === "Gradient") return "gradient"
  if (type === "String" && key.startsWith("easing")) return "easing"
  if (type === "Dimension" && key.startsWith("spacing")) return "spacing"
  return null
}

interface Measured {
  measure?: number
  unit?: string
  text?: string
  referencedTokenId?: string | null
}

/**
 * A typescale primitive in web's units (web value-renderer.ts): tracking in
 * em, line height as a ratio. Pixel values need the scale's font size, so
 * they are returned with `needsSize` and divided once all sizes are known.
 */
function typescaleValue(token: Token): { value: Value; needsSize?: "lineHeight" | "tracking" } {
  const v = (token as unknown as { value: Measured }).value
  const ref = v.referencedTokenId ?? undefined
  const type = String(token.tokenType)
  if (type === "FontFamily") return { value: { literal: v.text ?? "", ref } }
  const measure = v.measure ?? 0
  if ((type === "LineHeight" || type === "LetterSpacing") && v.unit === "Percent") {
    return { value: { literal: measure / 100, ref } }
  }
  if (type === "LineHeight" && v.unit === "Pixels") return { value: { literal: measure, ref }, needsSize: "lineHeight" }
  if (type === "LetterSpacing" && v.unit === "Pixels") return { value: { literal: measure, ref }, needsSize: "tracking" }
  return { value: { literal: measure, ref } }
}

function toHex2(n: number): string {
  return Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0")
}

/** Runtime opacity is 0–1, despite SDK docs suggesting 0–100 (web NOTES). */
function colorValueOf(v: ColorTokenValue): Value {
  const alpha = v.opacity?.measure ?? 1
  const literal = `#${toHex2(v.color.r)}${toHex2(v.color.g)}${toHex2(v.color.b)}${toHex2(alpha * 255)}`
  return v.referencedTokenId ? { literal, ref: v.referencedTokenId } : { literal }
}

function valueOf(token: Token, kind: Kind): Value {
  if (kind === "color") return colorValueOf((token as ColorToken).value)
  const v = (token as RadiusToken | DimensionToken).value
  return v.referencedTokenId ? { literal: v.measure, ref: v.referencedTokenId } : { literal: v.measure }
}

/**
 * A Supernova gradient as a model gradient, or null when Flutter cannot
 * express it. `GradientToken.value` is an array of layers, each with `from`
 * and `to` handles, a `type`, and `stops` whose `color` is a full
 * `ColorTokenValue`. A layer that aliases another gradient
 * (`referencedTokenId`) still carries its resolved handles and stops, so the
 * alias is not followed.
 */
function gradientValueOf(token: Token, key: string, notes: string[]): GradientValue | null {
  const layers = (token as GradientToken).value
  if (!Array.isArray(layers) || layers.length === 0) {
    notes.push(`gradient ${key}: no layers; skipped`)
    return null
  }
  if (layers.length > 1) notes.push(`gradient ${key}: ${layers.length} layers; exported the first only`)
  const layer = layers[0]
  const type = String(layer.type)
  if (type !== "Linear") {
    notes.push(`gradient ${key}: ${type} gradients are not exported; skipped`)
    return null
  }
  return {
    type: "linear",
    angle: cssAngleFromHandles(layer.from, layer.to),
    stops: layer.stops.map((stop) => ({ position: stop.position, color: colorValueOf(stop.color) })),
  }
}

function overrideMap(theme: TokenTheme | null | undefined): Map<string, Token> {
  return new Map((theme?.overriddenTokens ?? []).map((t) => [t.id, t]))
}

function layerOf(collection: DesignSystemCollection | undefined, base: Value): Layer {
  const name = collection?.name ?? ""
  if (name.startsWith("core")) return "core"
  if (name.startsWith("semantic")) return "semantic"
  return base.ref ? "semantic" : "core"
}

export function modelFromSdk(input: SdkInput): TokenModel {
  const notes: string[] = ["source: Supernova SDK"]
  const names = input.themeNames ?? DEFAULT_THEME_NAMES
  const groupsById = buildGroupsById(input.groups)
  const collectionsByPersistentId = new Map(input.collections.map((c) => [c.persistentId, c]))
  const rootDark = overrideMap(findRootTheme(input.themes, names.dark))
  const rootLight = overrideMap(findRootTheme(input.themes, names.light))
  const brandThemes = discoverBrands(input.themes, input.collections, names, notes)
  const brandMaps = brandThemes.map((b) => ({ slug: b.slug, dark: overrideMap(b.dark), light: overrideMap(b.light) }))

  const byKey = new Map<string, ModelToken>()
  const keyById = new Map<string, string>()
  const styles: Array<{ key: string; sourceId: string; collection: string }> = []
  const pixelTypescale: Array<{ key: string; needsSize: "lineHeight" | "tracking" }> = []
  let skipped = 0

  for (const token of input.tokens) {
    const key = buildTokenName(token, groupsById)
    const kind = kindOf(token, key)
    if (!kind) {
      skipped += 1
      continue
    }
    const collectionOf = token.collectionId ? collectionsByPersistentId.get(token.collectionId) : undefined
    if (kind === "typography") {
      styles.push({ key, sourceId: token.id, collection: collectionOf?.name ?? "(none)" })
      continue
    }
    if (kind === "duration" || kind === "easing") {
      const v = (token as unknown as { value: Measured }).value
      const literal = kind === "duration" ? (v.measure ?? 0) : normalizeTimingFunction(v.text ?? "")
      byKey.set(key, {
        key,
        sourceId: token.id,
        kind,
        layer: "core",
        collection: collectionOf?.name ?? "(none)",
        values: { dark: { literal }, light: { literal } },
        brandOverrides: {},
      })
      keyById.set(token.id, key)
      continue
    }
    if (kind === "typescale") {
      const { value, needsSize } = typescaleValue(token)
      if (needsSize) pixelTypescale.push({ key, needsSize })
      byKey.set(key, {
        key,
        sourceId: token.id,
        kind,
        layer: "core",
        collection: collectionOf?.name ?? "(none)",
        values: { dark: value, light: value },
        brandOverrides: {},
      })
      keyById.set(token.id, key)
      continue
    }
    if (kind === "gradient") {
      const base = gradientValueOf(token, key, notes)
      if (!base) continue
      const gradient = (t: Token | undefined) => (t ? gradientValueOf(t, key, notes) ?? undefined : undefined)
      const dark = gradient(rootDark.get(token.id)) ?? base
      const brandOverrides: Record<string, Partial<GradientModes>> = {}
      for (const brand of brandMaps) {
        const d = gradient(brand.dark.get(token.id))
        const l = gradient(brand.light.get(token.id))
        if (d || l) brandOverrides[brand.slug] = { ...(d && { dark: d }), ...(l && { light: l }) }
      }
      byKey.set(key, {
        key,
        sourceId: token.id,
        kind,
        layer: "semantic",
        collection: collectionOf?.name ?? "(none)",
        values: { dark: { literal: "" }, light: { literal: "" } },
        brandOverrides: {},
        gradient: { values: { dark, light: gradient(rootLight.get(token.id)) ?? dark }, brandOverrides },
      })
      keyById.set(token.id, key)
      continue
    }
    const base = valueOf(token, kind)
    const darkOverride = rootDark.get(token.id)
    const lightOverride = rootLight.get(token.id)
    const dark = darkOverride ? valueOf(darkOverride, kind) : base
    const values: ModeValues = { dark, light: lightOverride ? valueOf(lightOverride, kind) : dark }

    const brandOverrides: ModelToken["brandOverrides"] = {}
    for (const brand of brandMaps) {
      const d = brand.dark.get(token.id)
      const l = brand.light.get(token.id)
      if (d || l) brandOverrides[brand.slug] = { ...(d && { dark: valueOf(d, kind) }), ...(l && { light: valueOf(l, kind) }) }
    }

    const collection = token.collectionId ? collectionsByPersistentId.get(token.collectionId) : undefined
    const modelToken: ModelToken = {
      key,
      sourceId: token.id,
      kind,
      layer: layerOf(collection, base),
      collection: collection?.name ?? "(none)",
      values,
      brandOverrides,
    }

    const existing = byKey.get(key)
    if (existing) {
      // Alias suppression (web json-writer): a semantic-density token aliases the
      // core token of the same name. Keep the core one and drop the alias.
      const incomingAliasesExisting = base.ref === existing.sourceId
      const existingAliasesIncoming = existing.values.dark.ref === token.id
      if (existingAliasesIncoming) {
        byKey.set(key, modelToken)
        keyById.set(token.id, key)
        keyById.set(existing.sourceId, key)
      } else if (incomingAliasesExisting) {
        keyById.set(token.id, key)
      } else {
        notes.push(`duplicate key ${key}: kept ${existing.sourceId}, dropped ${token.id}`)
      }
      continue
    }
    byKey.set(key, modelToken)
    keyById.set(token.id, key)
  }

  // References arrive as Supernova ids; the model references keys.
  const rekey = (value: Value | undefined): Value | undefined => {
    if (!value?.ref) return value
    const key = keyById.get(value.ref)
    if (!key) notes.push(`reference to unknown or unsupported token id ${value.ref}`)
    return key ? { ...value, ref: key } : { literal: value.literal }
  }
  const rekeyGradient = (g: GradientValue | undefined): GradientValue | undefined =>
    g && { ...g, stops: g.stops.map((stop) => ({ ...stop, color: rekey(stop.color)! })) }
  for (const token of byKey.values()) {
    if (token.gradient) {
      const { values, brandOverrides } = token.gradient
      token.gradient = {
        values: { dark: rekeyGradient(values.dark)!, light: rekeyGradient(values.light)! },
        brandOverrides: Object.fromEntries(
          Object.entries(brandOverrides).map(([slug, o]) => [
            slug,
            { ...(o.dark && { dark: rekeyGradient(o.dark) }), ...(o.light && { light: rekeyGradient(o.light) }) },
          ]),
        ),
      }
      continue
    }
    token.values = { dark: rekey(token.values.dark)!, light: rekey(token.values.light)! }
    for (const [slug, override] of Object.entries(token.brandOverrides)) {
      token.brandOverrides[slug] = {
        ...(override.dark && { dark: rekey(override.dark) }),
        ...(override.light && { light: rekey(override.light) }),
      }
    }
  }

  // Pixel line heights and tracking become ratios of their scale's font size.
  for (const { key, needsSize } of pixelTypescale) {
    const token = byKey.get(key)!
    const suffix = needsSize === "lineHeight" ? /LineHeight$/ : /Tracking(Em)?$/
    const size = byKey.get(key.replace(suffix, "Size"))?.values.dark.literal
    if (typeof size !== "number" || size === 0) {
      notes.push(`typescale ${key}: pixel value with no font size to divide by; kept as px`)
      continue
    }
    const ratio: Value = { literal: Number(token.values.dark.literal) / size }
    token.values = { dark: ratio, light: ratio }
  }

  const typescale = [...byKey.values()].filter((t) => t.kind === "typescale")
  for (const style of typographyTokens(styles, typescale, notes)) byKey.set(style.key, style)

  const brands = brandThemes.map((b) => b.slug)
  if (brands.length === 0) {
    notes.push("no extended collections found; writing a single `default` brand")
    brands.push("default")
  }
  if (skipped > 0) notes.push(`${skipped} token(s) of types not yet exported (shadow, blur, ...)`)
  for (const b of brandThemes) {
    const count = [...byKey.values()].filter((t) => t.brandOverrides[b.slug] || t.gradient?.brandOverrides[b.slug]).length
    notes.push(`brand ${b.slug} <- ${b.collectionName}: ${count} overridden token(s)`)
  }
  return { brands, tokens: [...byKey.values()], notes }
}
