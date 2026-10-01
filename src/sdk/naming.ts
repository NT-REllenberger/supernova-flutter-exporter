/**
 * Token keys, ported from supernova-web-exporter `src/lib/token-name.ts`.
 *
 * The rules must stay identical to web, because the key is the name both
 * platforms share: `Skin / BG / "Screen Primary"` -> `skinBgScreenPrimary`.
 * Change them in both exporters or neither.
 */

import type { Token, TokenGroup } from "@supernovaio/sdk-exporters"

/** `'Screen Primary'` -> `'ScreenPrimary'`, `'BG'` -> `'Bg'`, `'050'` -> `'050'`. */
export function normalizeSegment(str: string): string {
  return str
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => (/^\d+$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join("")
}

/** `'semantic-theme-tdv'` -> `'semanticThemeTdv'`. */
export function toCamelCase(str: string): string {
  return str
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word, i) => {
      if (i === 0) return word.toLowerCase()
      if (/^\d+$/.test(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join("")
}

export function buildGroupsById(groups: TokenGroup[]): Map<string, TokenGroup> {
  return new Map(groups.map((g) => [g.id, g]))
}

/** Non-root group names from the root down. The root group is the collection. */
function groupPath(group: TokenGroup | undefined, groupsById: Map<string, TokenGroup>): string[] {
  const path: string[] = []
  let current = group
  while (current && !current.isRoot) {
    path.unshift(current.name)
    current = current.parentGroupId ? groupsById.get(current.parentGroupId) : undefined
  }
  return path
}

export function buildTokenName(token: Token, groupsById: Map<string, TokenGroup>): string {
  const parent = token.parentGroupId ? groupsById.get(token.parentGroupId) : undefined
  const segments = [...groupPath(parent, groupsById), token.name].map(normalizeSegment).filter(Boolean)
  if (segments.length === 0) return "unnamed"
  const first = segments[0]
  return first.charAt(0).toLowerCase() + first.slice(1) + segments.slice(1).join("")
}
