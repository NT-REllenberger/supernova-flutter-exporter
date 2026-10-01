import { describe, expect, it } from "vitest"

import { modelFromTokensJson, normalizeColor, parseColorValue, parseLinearGradient } from "../tokens-json"

describe("colour parsing", () => {
  it("normalises every web colour form to #rrggbbaa", () => {
    expect(normalizeColor("#0161E7")).toBe("#0161e7ff")
    expect(normalizeColor("rgba(107, 111, 118, 0.25)")).toBe("#6b6f7640")
    expect(normalizeColor("#fff")).toBe("#ffffffff")
  })

  it("splits a var() alias into its reference and fallback literal", () => {
    expect(parseColorValue("var(--neutral-cool-neutral-025, #eef2f7)")).toEqual({
      literal: "#eef2f7ff",
      ref: "neutralCoolNeutral025",
    })
  })
})

describe("modelFromTokensJson", () => {
  const json = {
    collections: {
      color: {
        blueBaseBlue600: { type: "Color", default: "#2b7cfe" },
        orangeBaseOrange700: { type: "Color", default: "#ff4200" },
        skinTextBrand: { type: "Color", default: "var(--orange-base-orange-700, #ff4200)" },
        buttonColorBuyHigh: { type: "Color", dark: "var(--blue-base-blue-600, #2b7cfe)" },
      },
      borderRadius: {
        radiusRadius100: { type: "BorderRadius", default: "8px" },
        radiusRadiusM: { type: "BorderRadius", default: "8px" },
      },
    },
    brands: {
      nt: { color: { skinTextBrand: { type: "Color", default: "#ff4200" } } },
      tdv: { color: { skinTextBrand: { type: "Color", default: "#2b7cfe" } } },
    },
  }

  it("puts literal-only ramps in core and aliases in semantic", () => {
    const { tokens } = modelFromTokensJson(json)
    const layer = (key: string) => tokens.find((t) => t.key === key)?.layer

    expect(layer("blueBaseBlue600")).toBe("core")
    expect(layer("skinTextBrand")).toBe("semantic")
    expect(layer("radiusRadius100")).toBe("core")
    expect(layer("radiusRadiusM")).toBe("semantic")
  })

  it("gives a dark-only token the same value in light", () => {
    const buy = modelFromTokensJson(json).tokens.find((t) => t.key === "buttonColorBuyHigh")!
    expect(buy.values.light).toEqual(buy.values.dark)
  })

  it("maps a semantic size to the core token with the same value", () => {
    const m = modelFromTokensJson(json).tokens.find((t) => t.key === "radiusRadiusM")!
    expect(m.values.dark.ref).toBe("radiusRadius100")
  })

  it("keeps only brand values that differ, mapped back to a core colour", () => {
    const { brands, tokens } = modelFromTokensJson(json)
    const brand = tokens.find((t) => t.key === "skinTextBrand")!

    expect(brands).toEqual(["nt", "tdv"])
    expect(brand.brandOverrides.nt).toBeUndefined()
    expect(brand.brandOverrides.tdv?.dark).toEqual({ literal: "#2b7cfeff", ref: "blueBaseBlue600" })
  })
})

describe("local gradients", () => {
  it("parses a web linear-gradient into angle and referenced stops", () => {
    expect(
      parseLinearGradient(
        "linear-gradient(156deg, var(--skin-gradient-brand-main-subtle-stop-01, rgba(255, 66, 0, 0.3)) 20%, var(--skin-gradient-brand-main-subtle-stop-02, #ed35fe) 100%)",
      ),
    ).toEqual({
      type: "linear",
      angle: 156,
      stops: [
        { color: { literal: "#ff42004d", ref: "skinGradientBrandMainSubtleStop01" }, position: 0.2 },
        { color: { literal: "#ed35feff", ref: "skinGradientBrandMainSubtleStop02" }, position: 1 },
      ],
    })
  })

  it("reads side keywords and refuses what Flutter's model cannot hold", () => {
    expect(parseLinearGradient("linear-gradient(to right, #000 0%, #fff 100%)").angle).toBe(90)
    expect(() => parseLinearGradient("linear-gradient(to top right, #000 0%, #fff 100%)")).toThrow(/direction/)
    expect(() => parseLinearGradient("radial-gradient(circle, #000 0%, #fff 100%)")).toThrow(/linear-gradient/)
    expect(() => parseLinearGradient("linear-gradient(90deg, #000, #fff)")).toThrow(/position/)
  })

  it("builds gradient tokens from the gradient collection and reports skipped ones", () => {
    const { tokens, notes } = modelFromTokensJson({
      collections: {
        color: {
          orangeBaseOrange700: { type: "Color", default: "#ff4200" },
          skinGradientBrandMainStop01: { type: "Color", dark: "var(--orange-base-orange-700, #ff4200)" },
        },
        gradient: {
          gradientBrandMain: {
            type: "Gradient",
            default: "linear-gradient(156deg, var(--skin-gradient-brand-main-stop-01, #ff4200) 20%, #ed35fe 100%)",
          },
          gradientGlow: { type: "Gradient", default: "radial-gradient(circle, #000 0%, #fff 100%)" },
        },
      },
    })
    const main = tokens.find((t) => t.key === "gradientBrandMain")!

    expect(main.kind).toBe("gradient")
    expect(main.layer).toBe("semantic")
    expect(main.gradient?.values.dark.stops[0].color.ref).toBe("skinGradientBrandMainStop01")
    expect(main.gradient?.values.light).toEqual(main.gradient?.values.dark)
    expect(tokens.find((t) => t.key === "gradientGlow")).toBeUndefined()
    expect(notes.some((n) => n.startsWith("gradient gradientGlow: not a linear-gradient"))).toBe(true)
  })
})
