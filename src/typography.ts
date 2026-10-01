/**
 * Builds semantic text styles from core `typescale` tokens by name.
 *
 * Strata names every typography token after its scale, and every scale owns a
 * set of primitives:
 *
 *   labelMedium        -> typescaleLabelMedium{Size, LineHeight, FontFamily, FontWeight, Tracking, …}
 *   labelMediumStrong  -> same scale, FontWeightEm and TrackingEm
 *   labelMediumLink    -> same scale, underlined
 *   labelNumericMedium -> its own scale, typescaleLabelNumericMedium…
 *
 * Both adapters use this, so the rule lives in one place.
 */

import { ModelToken, TypeStyle, Value } from "./model"

export interface StyleName {
  scale: string
  strong: boolean
  link: boolean
}

export function parseStyleName(name: string): StyleName {
  const strong = name.endsWith("Strong")
  const link = name.endsWith("Link")
  const base = strong ? name.slice(0, -"Strong".length) : link ? name.slice(0, -"Link".length) : name
  return { scale: base.charAt(0).toUpperCase() + base.slice(1), strong, link }
}

/** Defaults match CSS when a scale omits a flag: ligatures on, the rest off. */
const FEATURE_DEFAULTS = { lnum: 0, tnum: 0, liga: 1, zero: 0 } as const

export function typeStyleFor(name: string, typescale: Map<string, ModelToken>): TypeStyle | null {
  const { scale, strong, link } = parseStyleName(name)
  const prefix = `typescale${scale}`
  const ref = (...suffixes: string[]): Value | null => {
    for (const suffix of suffixes) {
      const token = typescale.get(`${prefix}${suffix}`)
      if (token) return { literal: token.values.dark.literal, ref: token.key }
    }
    return null
  }

  const size = ref("Size")
  const lineHeight = ref("LineHeight")
  const family = ref("FontFamily")
  const weight = strong ? ref("FontWeightEm", "FontWeight") : ref("FontWeight")
  if (!size || !lineHeight || !family || !weight) return null

  return {
    family,
    size,
    lineHeight,
    weight,
    tracking: (strong ? ref("TrackingEm", "Tracking") : ref("Tracking")) ?? { literal: 0 },
    lnum: ref("Liningfigures") ?? { literal: FEATURE_DEFAULTS.lnum },
    tnum: ref("Numerictabular") ?? { literal: FEATURE_DEFAULTS.tnum },
    liga: ref("Standardligatures") ?? { literal: FEATURE_DEFAULTS.liga },
    zero: ref("Slashedzero") ?? { literal: FEATURE_DEFAULTS.zero },
    underline: link,
  }
}

/** Semantic typography tokens for every style name that resolves. */
export function typographyTokens(
  styles: Array<{ key: string; sourceId: string; collection: string }>,
  typescaleTokens: ModelToken[],
  notes: string[],
): ModelToken[] {
  const typescale = new Map(typescaleTokens.map((t) => [t.key, t]))
  const tokens: ModelToken[] = []
  for (const style of styles) {
    const typeStyle = typeStyleFor(style.key, typescale)
    if (!typeStyle) {
      notes.push(`typography ${style.key}: no typescale${parseStyleName(style.key).scale} primitives; skipped`)
      continue
    }
    const placeholder: Value = { literal: 0 }
    tokens.push({
      key: style.key,
      sourceId: style.sourceId,
      kind: "typography",
      layer: "semantic",
      collection: style.collection,
      values: { dark: placeholder, light: placeholder },
      brandOverrides: {},
      typeStyle,
    })
  }
  return tokens
}
