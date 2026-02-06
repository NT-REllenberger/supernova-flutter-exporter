import { Token, TokenGroup } from "@supernovaio/sdk-exporters"
import { TokenNameStyle } from "../../config"

/**
 * Tracks generated token names to handle deduplication.
 */
const nameCounters = new Map<string, number>()

/**
 * Resets the name tracking state. Call before generating a new file
 * to avoid cross-file deduplication conflicts.
 */
export function resetTokenNameTracking(): void {
  nameCounters.clear()
}

/**
 * Builds the full path segments for a token by looking up its parent group chain.
 */
function tokenPathSegments(token: Token, tokenGroups: Array<TokenGroup>): string[] {
  // Use tokenPath if available (SDK v2+)
  if (token.tokenPath && token.tokenPath.length > 0) {
    return [...token.tokenPath, token.name]
  }

  // Fallback: walk parent groups
  const groupMap = new Map(tokenGroups.map((g) => [g.id, g]))
  const segments: string[] = []
  let currentGroupId: string | null = token.parentGroupId

  while (currentGroupId) {
    const group = groupMap.get(currentGroupId)
    if (!group || group.isRoot) break
    segments.unshift(group.name)
    currentGroupId = group.parentGroupId
  }

  segments.push(token.name)
  return segments
}

/**
 * Converts a string to camelCase.
 */
function toCamelCase(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word, i) => {
      if (i === 0) return word.toLowerCase()
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join("")
}

/**
 * Converts a string to PascalCase.
 */
function toPascalCase(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("")
}

/**
 * Converts a string to snake_case.
 */
function toSnakeCase(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => word.toLowerCase())
    .join("_")
}

/**
 * Converts a string to CONSTANT_CASE.
 */
function toConstantCase(input: string): string {
  return toSnakeCase(input).toUpperCase()
}

/**
 * Applies the configured naming style to a raw string.
 */
function applyNamingStyle(raw: string, style: TokenNameStyle): string {
  switch (style) {
    case TokenNameStyle.CamelCase:
      return toCamelCase(raw)
    case TokenNameStyle.PascalCase:
      return toPascalCase(raw)
    case TokenNameStyle.SnakeCase:
      return toSnakeCase(raw)
    case TokenNameStyle.ConstantCase:
      return toConstantCase(raw)
    default:
      return toCamelCase(raw)
  }
}

/**
 * Ensures the name is a valid Dart identifier (doesn't start with a digit, etc.).
 */
function ensureValidDartIdentifier(name: string): string {
  if (!name) return "_unnamed"
  // If starts with digit, prefix with underscore
  if (/^[0-9]/.test(name)) {
    return `_${name}`
  }
  return name
}

/**
 * Generates a unique, formatted token name from its group path and name.
 * Handles deduplication by appending a numeric suffix when collisions occur.
 */
export function tokenName(
  token: Token,
  tokenGroups: Array<TokenGroup>,
  style: TokenNameStyle
): string {
  const segments = tokenPathSegments(token, tokenGroups)
  const raw = segments.join(" ")
  let name = ensureValidDartIdentifier(applyNamingStyle(raw, style))

  // Deduplicate
  const count = nameCounters.get(name) ?? 0
  if (count > 0) {
    name = `${name}${count}`
  }
  nameCounters.set(name, count + 1)

  return name
}
