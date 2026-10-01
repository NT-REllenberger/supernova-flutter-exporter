import {
  Brand,
  DesignSystemCollection,
  OutputTextFile,
  PulsarContext,
  Token,
  TokenTheme,
} from "@supernovaio/sdk-exporters"

/** How many token names to sample per collection and per theme. */
const SAMPLE_SIZE = 8

type Counter = Record<string, number>

function count(counter: Counter, key: string): void {
  counter[key] = (counter[key] ?? 0) + 1
}

/**
 * Finds the collection a token belongs to. The SDK does not document whether
 * `Token.collectionId` holds the collection `id` or its `persistentId`, so both
 * are tried and the report records which one matched.
 */
function collectionFor(
  token: Token,
  collections: Array<DesignSystemCollection>,
): { collection: DesignSystemCollection | null; matchedBy: string } {
  if (!token.collectionId) return { collection: null, matchedBy: "none" }
  const byId = collections.find((c) => c.id === token.collectionId)
  if (byId) return { collection: byId, matchedBy: "id" }
  const byPersistentId = collections.find((c) => c.persistentId === token.collectionId)
  if (byPersistentId) return { collection: byPersistentId, matchedBy: "persistentId" }
  return { collection: null, matchedBy: "unmatched" }
}

function tokenLabel(token: Token): string {
  const path = token.tokenPath && token.tokenPath.length > 0 ? `${token.tokenPath.join("/")}/` : ""
  return `${path}${token.name}`
}

/**
 * Builds `discovery.json`: a read-only report of how Supernova structures the
 * design system. It answers which collections exist, which themes exist, and
 * which collections each theme overrides, so the Dart output layout can follow
 * the real data instead of a guess.
 */
export function discoveryOutputFile(
  context: PulsarContext,
  brands: Array<Brand>,
  collections: Array<DesignSystemCollection>,
  themes: Array<TokenTheme>,
  tokens: Array<Token>,
): OutputTextFile {
  const collectionName = (token: Token): string => {
    const { collection, matchedBy } = collectionFor(token, collections)
    return collection ? collection.name : `(no collection: ${matchedBy})`
  }

  const matchCounts: Counter = {}
  const collectionReport = new Map<
    string,
    { tokenCount: number; byType: Counter; byBrand: Counter; originSources: Counter; sample: Array<string> }
  >()

  for (const token of tokens) {
    count(matchCounts, collectionFor(token, collections).matchedBy)
    const name = collectionName(token)
    let entry = collectionReport.get(name)
    if (!entry) {
      entry = { tokenCount: 0, byType: {}, byBrand: {}, originSources: {}, sample: [] }
      collectionReport.set(name, entry)
    }
    entry.tokenCount += 1
    count(entry.byType, token.tokenType)
    count(entry.byBrand, token.brandId)
    count(entry.originSources, token.origin?.sourceId ?? "(none)")
    if (entry.sample.length < SAMPLE_SIZE) entry.sample.push(tokenLabel(token))
  }

  const report = {
    generatedAt: new Date().toISOString(),
    context: {
      dsId: context.dsId,
      versionId: context.versionId,
      brandId: context.brandId ?? null,
      themeIds: context.themeIds ?? [],
    },
    tokenCollectionMatch: matchCounts,
    brands: brands.map((b) => ({ id: b.id, idInVersion: b.idInVersion, name: b.name })),
    collections: collections.map((c) => ({
      id: c.id,
      persistentId: c.persistentId,
      name: c.name,
      description: c.description,
      parentPersistentId: c.parentPersistentId,
      originId: c.originId,
      originSourceId: c.originSourceId,
      ...(collectionReport.get(c.name) ?? { tokenCount: 0 }),
    })),
    tokensWithoutCollection: [...collectionReport.entries()]
      .filter(([name]) => name.startsWith("(no collection"))
      .map(([name, entry]) => ({ name, ...entry })),
    themes: themes.map((theme) => {
      const overridesByCollection: Counter = {}
      const overridesByType: Counter = {}
      for (const override of theme.overriddenTokens) {
        count(overridesByCollection, collectionName(override))
        count(overridesByType, override.tokenType)
      }
      return {
        id: theme.id,
        idInVersion: theme.idInVersion,
        name: theme.name,
        codeName: theme.codeName,
        brandId: theme.brandId,
        description: theme.description,
        overrideCount: theme.overriddenTokens.length,
        overridesByCollection,
        overridesByType,
        sample: theme.overriddenTokens.slice(0, SAMPLE_SIZE).map(tokenLabel),
      }
    }),
  }

  return {
    path: "./",
    name: "discovery.json",
    type: "text" as any,
    content: JSON.stringify(report, null, 2),
  }
}
