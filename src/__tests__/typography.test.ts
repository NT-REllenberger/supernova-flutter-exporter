import { describe, expect, it } from "vitest"

import { writeDart } from "../dart/writer"
import type { ModelToken } from "../model"
import { parseStyleName, typeStyleFor, typographyTokens } from "../typography"

function typescale(key: string, literal: string | number): ModelToken {
  return {
    key,
    sourceId: key,
    kind: "typescale",
    layer: "core",
    collection: "test",
    values: { dark: { literal }, light: { literal } },
    brandOverrides: {},
  }
}

const scale = [
  typescale("typescaleLabelMediumSize", 14),
  typescale("typescaleLabelMediumLineHeight", 1.1429),
  typescale("typescaleLabelMediumFontFamily", "Geist"),
  typescale("typescaleLabelMediumFontWeight", 350),
  typescale("typescaleLabelMediumFontWeightEm", 600),
  typescale("typescaleLabelMediumTracking", 0.01),
  typescale("typescaleLabelMediumTrackingEm", 0.005),
  typescale("typescaleLabelMediumNumerictabular", 0),
]
const byKey = new Map(scale.map((t) => [t.key, t]))

describe("style names", () => {
  it("splits the scale from the Strong and Link suffixes", () => {
    expect(parseStyleName("labelMedium")).toEqual({ scale: "LabelMedium", strong: false, link: false })
    expect(parseStyleName("labelMediumStrong")).toEqual({ scale: "LabelMedium", strong: true, link: false })
    expect(parseStyleName("paragraphSmallLink")).toEqual({ scale: "ParagraphSmall", strong: false, link: true })
    expect(parseStyleName("labelNumericMedium").scale).toBe("LabelNumericMedium")
  })
})

describe("typeStyleFor", () => {
  it("references the scale's regular weight and tracking", () => {
    const style = typeStyleFor("labelMedium", byKey)!
    expect(style.weight.ref).toBe("typescaleLabelMediumFontWeight")
    expect(style.tracking.ref).toBe("typescaleLabelMediumTracking")
    expect(style.underline).toBe(false)
  })

  it("uses the emphasis weight and tracking for Strong", () => {
    const style = typeStyleFor("labelMediumStrong", byKey)!
    expect(style.weight.ref).toBe("typescaleLabelMediumFontWeightEm")
    expect(style.tracking.ref).toBe("typescaleLabelMediumTrackingEm")
  })

  it("underlines Link and defaults missing feature flags like CSS", () => {
    const style = typeStyleFor("labelMediumLink", byKey)!
    expect(style.underline).toBe(true)
    expect(style.tnum.ref).toBe("typescaleLabelMediumNumerictabular")
    expect(style.liga).toEqual({ literal: 1 })
  })

  it("skips a style whose scale has no primitives", () => {
    const notes: string[] = []
    const tokens = typographyTokens([{ key: "displayHuge", sourceId: "x", collection: "test" }], scale, notes)
    expect(tokens).toHaveLength(0)
    expect(notes[0]).toContain("typescaleDisplayHuge")
  })
})

describe("writer typography", () => {
  it("emits core literals and TextStyles made only of references", () => {
    const styles = typographyTokens(
      [{ key: "labelMedium", sourceId: "s1", collection: "test" }, { key: "labelMediumStrong", sourceId: "s2", collection: "test" }],
      scale,
      [],
    )
    const result = writeDart({ brands: ["nt"], tokens: [...scale, ...styles], notes: [] })
    const core = result.files.find((f) => f.name === "typography.gen.dart" && f.path === "core/")!.content
    const semantic = result.files.find((f) => f.name === "typography.gen.dart" && f.path === "semantics/")!.content

    expect(core).toContain("static const String typescaleLabelMediumFontFamily = 'Geist';")
    expect(core).toContain("static const int typescaleLabelMediumFontWeight = 350;")
    expect(core).toContain("static const double typescaleLabelMediumSize = 14.0;")
    expect(semantic).toContain("fontWeight: FontWeight(TokenCore_Typography.typescaleLabelMediumFontWeightEm)")
    expect(semantic).toContain("letterSpacing: TokenCore_Typography.typescaleLabelMediumTracking * TokenCore_Typography.typescaleLabelMediumSize")
    expect(semantic).toContain("package: 'mobile_strata'")
    expect(semantic).toContain("leadingDistribution: TextLeadingDistribution.even")
    expect(semantic).not.toMatch(/fontSize: \d/)
  })
})
