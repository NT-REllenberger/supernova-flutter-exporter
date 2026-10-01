import { describe, expect, it } from "vitest"

import type { DesignSystemCollection, Token, TokenGroup, TokenTheme } from "@supernovaio/sdk-exporters"

import { modelFromSdk } from "../adapter"

// Plain objects shaped like the SDK classes. Only the fields the adapter reads.
const group = (id: string, name: string, parentGroupId: string | null, isRoot = false) =>
  ({ id, name, parentGroupId, isRoot }) as unknown as TokenGroup

const collection = (persistentId: string, name: string, parentPersistentId: string | null = null) =>
  ({ id: `num-${persistentId}`, persistentId, name, parentPersistentId }) as unknown as DesignSystemCollection

function colorToken(id: string, name: string, groupId: string, collectionId: string, hex: string, ref: string | null = null): Token {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return {
    id,
    name,
    tokenType: "Color",
    parentGroupId: groupId,
    collectionId,
    value: { color: { r, g, b, referencedTokenId: null }, opacity: { measure: 1 }, referencedTokenId: ref },
  } as unknown as Token
}

function radiusToken(id: string, name: string, groupId: string, collectionId: string, px: number, ref: string | null = null): Token {
  return {
    id,
    name,
    tokenType: "BorderRadius",
    parentGroupId: groupId,
    collectionId,
    value: { measure: px, unit: "Pixels", referencedTokenId: ref },
  } as unknown as Token
}

const theme = (id: string, name: string, codeName: string, overriddenTokens: Token[] = []) =>
  ({ id, name, codeName, overriddenTokens }) as unknown as TokenTheme

const groups = [
  group("root", "root", null, true),
  group("blue", "Blue", "root"),
  group("blueBase", "Base", "blue"),
  group("skin", "Skin", "root"),
  group("skinText", "Text", "skin"),
  group("radius", "Radius", "root"),
]

const collections = [
  collection("p-core-color", "core-color"),
  collection("p-core-density", "core-density"),
  collection("p-semantic-density", "semantic-density"),
  collection("p-theme", "semantic-theme"),
  collection("p-nt", "semantic-theme-nt", "p-theme"),
  collection("p-tdv", "semantic-theme-tdv", "p-theme"),
]

const blue700 = colorToken("t-b700", "Blue 700", "blueBase", "p-core-color", "0161e7")
const blue600 = colorToken("t-b600", "Blue 600", "blueBase", "p-core-color", "2b7cfe")
const link = colorToken("t-link", "Link", "skinText", "p-theme", "0161e7", "t-b700")
const radiusCore = radiusToken("t-rc", "radius-none", "radius", "p-core-density", 0)
const radiusAlias = radiusToken("t-ra", "radius-none", "radius", "p-semantic-density", 0, "t-rc")

function build(themes: TokenTheme[]) {
  return modelFromSdk({ tokens: [blue700, blue600, link, radiusCore, radiusAlias], groups, themes, collections })
}

describe("modelFromSdk", () => {
  it("names tokens like web and assigns layers by collection persistentId", () => {
    const { tokens } = build([])
    const byKey = new Map(tokens.map((t) => [t.key, t]))

    expect(byKey.get("blueBaseBlue700")?.layer).toBe("core")
    expect(byKey.get("skinTextLink")?.layer).toBe("semantic")
    expect(byKey.get("skinTextLink")?.collection).toBe("semantic-theme")
    expect(byKey.get("skinTextLink")?.values.dark.ref).toBe("blueBaseBlue700")
  })

  it("picks root themes by codeName and pairs brand themes with extended collections", () => {
    const lightLink = colorToken("t-link", "Link", "skinText", "p-theme", "2b7cfe", "t-b600")
    const tdvLink = colorToken("t-link", "Link", "skinText", "p-theme", "2b7cfe", "t-b600")
    const { brands, tokens, notes } = build([
      theme("th-nt-d", "Dark", "dark_df0f"),
      theme("th-nt-l", "Light", "light_dd06"),
      theme("th-d", "Dark", "dark"),
      theme("th-l", "Light", "light", [lightLink]),
      theme("th-tdv-d", "Dark", "dark_87ea", [tdvLink]),
      theme("th-tdv-l", "Light", "light_5704"),
    ])
    const linkToken = tokens.find((t) => t.key === "skinTextLink")!

    expect(brands).toEqual(["nt", "tdv"])
    expect(linkToken.values.light.ref).toBe("blueBaseBlue600")
    expect(linkToken.brandOverrides.nt).toBeUndefined()
    expect(linkToken.brandOverrides.tdv).toEqual({ dark: { literal: "#2b7cfeff", ref: "blueBaseBlue600" } })
    expect(notes).toContain("brand nt <- semantic-theme-nt: 0 overridden token(s)")
  })

  it("applies a root dark-only override to light as well", () => {
    const darkLink = colorToken("t-link", "Link", "skinText", "p-theme", "2b7cfe", "t-b600")
    const { tokens } = build([theme("th-d", "Dark", "dark", [darkLink]), theme("th-l", "Light", "light")])
    const linkToken = tokens.find((t) => t.key === "skinTextLink")!

    expect(linkToken.values.dark.ref).toBe("blueBaseBlue600")
    expect(linkToken.values.light.ref).toBe("blueBaseBlue600")
  })

  it("drops a semantic-density alias that shares its core token's name", () => {
    const radii = build([]).tokens.filter((t) => t.kind === "radius")

    expect(radii).toHaveLength(1)
    expect(radii[0].sourceId).toBe("t-rc")
    expect(radii[0].layer).toBe("core")
  })

  it("keeps the core token when the alias arrives first", () => {
    const { tokens } = modelFromSdk({ tokens: [radiusAlias, radiusCore], groups, themes: [], collections })
    const radii = tokens.filter((t) => t.kind === "radius")

    expect(radii.map((t) => t.sourceId)).toEqual(["t-rc"])
  })
})

describe("modelFromSdk gradients", () => {
  const gradientGroups = [...groups, group("skinGradient", "Gradient", "skin"), group("gradient", "Gradient", "root")]
  const stop1 = colorToken("t-s1", "Brand Main Stop 01", "skinGradient", "p-theme", "0161e7", "t-b700")
  const stop2 = colorToken("t-s2", "Brand Main Stop 02", "skinGradient", "p-theme", "2b7cfe", "t-b600")

  // A GradientTokenValue layer: handles are box fractions, y down.
  function gradientToken(id: string, name: string, type = "Linear", angle = 156): Token {
    const rad = (angle * Math.PI) / 180
    const to = { x: 0.5 + 0.5 * Math.sin(rad), y: 0.5 - 0.5 * Math.cos(rad) }
    const stopColor = (ref: string, hex: string) => {
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
      return { color: { r, g, b, referencedTokenId: null }, opacity: { measure: 1 }, referencedTokenId: ref }
    }
    return {
      id,
      name,
      tokenType: "Gradient",
      parentGroupId: "gradient",
      collectionId: "p-theme",
      value: [
        {
          type,
          from: { x: 1 - to.x, y: 1 - to.y },
          to,
          aspectRatio: 1,
          referencedTokenId: null,
          stops: [
            { position: 0.2, color: stopColor("t-s1", "0161e7") },
            { position: 1, color: stopColor("t-s2", "2b7cfe") },
          ],
        },
      ],
    } as unknown as Token
  }

  function buildGradients(extra: Token[], themes: TokenTheme[] = []) {
    return modelFromSdk({ tokens: [blue700, blue600, stop1, stop2, ...extra], groups: gradientGroups, themes, collections })
  }

  it("reads angle and stops, with each stop referencing its colour token's key", () => {
    const { tokens } = buildGradients([gradientToken("t-g", "Brand Main")])
    const token = tokens.find((t) => t.key === "gradientBrandMain")!

    expect(token.kind).toBe("gradient")
    expect(token.gradient?.values.dark).toEqual({
      type: "linear",
      angle: 156,
      stops: [
        { position: 0.2, color: { literal: "#0161e7ff", ref: "skinGradientBrandMainStop01" } },
        { position: 1, color: { literal: "#2b7cfeff", ref: "skinGradientBrandMainStop02" } },
      ],
    })
    expect(token.gradient?.values.light).toEqual(token.gradient?.values.dark)
  })

  it("skips a non-linear gradient and reports it", () => {
    const { tokens, notes } = buildGradients([gradientToken("t-r", "Radial Glow", "Radial")])

    expect(tokens.find((t) => t.key === "gradientRadialGlow")).toBeUndefined()
    expect(notes).toContain("gradient gradientRadialGlow: Radial gradients are not exported; skipped")
  })

  it("applies a brand override of the gradient itself to that brand", () => {
    const { tokens } = buildGradients(
      [gradientToken("t-g", "Brand Main")],
      [
        theme("th-d", "Dark", "dark"),
        theme("th-l", "Light", "light"),
        theme("th-nt-d", "Dark", "dark_df0f"),
        theme("th-nt-l", "Light", "light_dd06"),
        theme("th-tdv-d", "Dark", "dark_87ea", [gradientToken("t-g", "Brand Main", "Linear", 90)]),
        theme("th-tdv-l", "Light", "light_5704"),
      ],
    )
    const token = tokens.find((t) => t.key === "gradientBrandMain")!

    expect(token.gradient?.brandOverrides.nt).toBeUndefined()
    expect(token.gradient?.brandOverrides.tdv?.dark?.angle).toBe(90)
    expect(token.gradient?.brandOverrides.tdv?.dark?.stops[0].color.ref).toBe("skinGradientBrandMainStop01")
  })
})
