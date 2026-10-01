/**
 * Mode and brand discovery, ported from supernova-web-exporter
 * `src/lib/theme-resolver.ts` (findRootTheme) and `src/lib/brand-themes.ts`.
 *
 * Strata has one Supernova brand. Its NinjaTrader and Tradovate brands are
 * Figma extended collections (`semantic-theme-nt`, `semantic-theme-tdv`),
 * which Supernova exposes as extra themes named "Dark" / "Light". Only
 * `codeName` tells them apart: root `dark` / `light`, extensions `dark_df0f`.
 *
 * One difference from web: a brand with no overrides is kept, because every
 * brand needs a complete theme file.
 */

import type { DesignSystemCollection, TokenTheme } from "@supernovaio/sdk-exporters"

import { toCamelCase } from "./naming"

export interface ThemeNames {
  dark: string
  light: string
}

export const DEFAULT_THEME_NAMES: ThemeNames = { dark: "Dark", light: "Light" }

export interface BrandThemes {
  slug: string
  collectionName: string
  dark: TokenTheme | null
  light: TokenTheme | null
}

interface ExtraPair {
  dark: TokenTheme | null
  light: TokenTheme | null
  collectionPersistentId?: string
}

const named = (theme: TokenTheme, name: string) => theme.name.toLowerCase() === name.toLowerCase()

/** Exact `codeName` first, then an unsuffixed name match, then any name match. */
export function findRootTheme(themes: TokenTheme[], name: string): TokenTheme | undefined {
  const wanted = name.toLowerCase()
  const byCodeName = themes.find((t) => t.codeName?.toLowerCase() === wanted)
  if (byCodeName) return byCodeName
  const byName = themes.filter((t) => t.name.toLowerCase() === wanted)
  return byName.find((t) => !t.codeName || t.codeName.toLowerCase() === wanted) ?? byName[0]
}

/**
 * `collectionPersistentIds` is on the SDK type but often missing at runtime,
 * so it is read defensively.
 */
function collectionIdsOf(theme: TokenTheme): string[] {
  const ids = (theme as unknown as { collectionPersistentIds?: unknown }).collectionPersistentIds
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string" && id.length > 0) : []
}

function pairByCollectionId(extra: TokenTheme[], names: ThemeNames): ExtraPair[] | null {
  const groups = new Map<string, ExtraPair>()
  for (const theme of extra) {
    const ids = collectionIdsOf(theme)
    if (ids.length !== 1) return null
    const slot = groups.get(ids[0]) ?? { dark: null, light: null, collectionPersistentId: ids[0] }
    if (named(theme, names.dark)) slot.dark = theme
    else slot.light = theme
    groups.set(ids[0], slot)
  }
  return [...groups.values()]
}

function pairByIndex(extra: TokenTheme[], names: ThemeNames): ExtraPair[] {
  const pairs: ExtraPair[] = []
  for (let i = 0; i < extra.length; i++) {
    const current = extra[i]
    const next = extra[i + 1]
    if (named(current, names.dark) && next && named(next, names.light)) {
      pairs.push({ dark: current, light: next })
      i += 1
    } else if (named(current, names.dark)) {
      pairs.push({ dark: current, light: null })
    } else {
      pairs.push({ dark: null, light: current })
    }
  }
  return pairs
}

/** `semantic-theme-tdv` extending `semantic-theme` -> `tdv`. */
export function brandSlug(collection: DesignSystemCollection, parent: DesignSystemCollection | undefined): string {
  if (parent && collection.name.startsWith(`${parent.name}-`)) {
    return toCamelCase(collection.name.slice(parent.name.length + 1))
  }
  return toCamelCase(collection.name)
}

export function discoverBrands(
  themes: TokenTheme[],
  collections: DesignSystemCollection[],
  names: ThemeNames,
  notes: string[],
): BrandThemes[] {
  const roots = new Set(
    [findRootTheme(themes, names.dark), findRootTheme(themes, names.light)].filter(Boolean).map((t) => t!.id),
  )
  const extra = themes.filter((t) => !roots.has(t.id) && (named(t, names.dark) || named(t, names.light)))
  const pairs = pairByCollectionId(extra, names) ?? pairByIndex(extra, names)
  const byPersistentId = new Map(collections.map((c) => [c.persistentId, c]))
  const extended = collections.filter((c) => Boolean(c.parentPersistentId))

  const toBrand = (collection: DesignSystemCollection, pair: ExtraPair): BrandThemes => ({
    slug: brandSlug(collection, byPersistentId.get(collection.parentPersistentId ?? "")),
    collectionName: collection.name,
    dark: pair.dark,
    light: pair.light,
  })

  if (pairs.length > 0 && pairs.every((p) => p.collectionPersistentId)) {
    const byCollection = new Map(pairs.map((p) => [p.collectionPersistentId!, p]))
    return extended.flatMap((c) => {
      const pair = byCollection.get(c.persistentId)
      return pair ? [toBrand(c, pair)] : []
    })
  }

  if (extended.length !== pairs.length) {
    notes.push(
      `extended collections (${extended.length}) and extra Dark/Light pairs (${pairs.length}) differ; ` +
        "paired by list order, so later brands may carry the wrong slug",
    )
  }
  const n = Math.min(extended.length, pairs.length)
  return extended.slice(0, n).map((c, i) => toBrand(c, pairs[i]))
}
