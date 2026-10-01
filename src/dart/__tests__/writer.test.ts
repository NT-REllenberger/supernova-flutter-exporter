import { describe, expect, it } from "vitest"

import type { ModelToken, TokenModel, Value } from "../../model"
import { colorGroupFor, dartColor, dartMember } from "../naming"
import { writeDart } from "../writer"

function color(key: string, layer: ModelToken["layer"], dark: Value, light: Value = dark): ModelToken {
  return { key, sourceId: `id-${key}`, kind: "color", layer, collection: "test", values: { dark, light }, brandOverrides: {} }
}

function model(tokens: ModelToken[], brands = ["nt"]): TokenModel {
  return { brands, tokens, notes: [] }
}

function content(result: ReturnType<typeof writeDart>, name: string): string {
  const match = result.files.find((f) => `${f.path}${f.name}` === name)
  if (!match) throw new Error(`missing ${name}`)
  return match.content
}

const ramp = color("blueBaseBlue700", "core", { literal: "#0161e7ff" })
const rampLight = color("blueBaseBlue600", "core", { literal: "#2b7cfeff" })

describe("naming", () => {
  it("drops one repeated leading word", () => {
    expect(dartMember("radiusRadiusXs")).toBe("radiusXs")
    expect(dartMember("spacingSpacing100")).toBe("spacing100")
    expect(dartMember("skinTextPrimary")).toBe("skinTextPrimary")
  })

  it("writes ARGB colour literals", () => {
    expect(dartColor("#0161e7ff")).toBe("Color(0xff0161e7)")
    expect(dartColor("#6b6f7640")).toBe("Color(0x406b6f76)")
    expect(() => dartColor("rgba(1,2,3,1)")).toThrow()
  })

  it("groups component tokens by prefix at a word boundary", () => {
    expect(colorGroupFor(color("buttonColorBuyHigh", "semantic", ramp.values.dark)).field).toBe("button")
    expect(colorGroupFor(color("indictorBrand", "semantic", ramp.values.dark)).field).toBe("indicator")
    expect(colorGroupFor(color("skinTextPrimary", "semantic", ramp.values.dark)).field).toBe("theme")
    expect(colorGroupFor(color("fieldsetBorder", "semantic", ramp.values.dark)).field).toBe("theme")
  })
})

describe("writeDart", () => {
  it("keeps literals in core and references in brand files", () => {
    const text = color("skinTextLink", "semantic", { literal: "#0161e7ff", ref: ramp.key }, { literal: "#2b7cfeff", ref: rampLight.key })
    const result = writeDart(model([ramp, rampLight, text]))

    expect(content(result, "core/color.gen.dart")).toContain("static const Color blueBaseBlue700 = Color(0xff0161e7);")
    const brand = content(result, "semantics/themes/brands/nt.gen.dart")
    expect(brand).toContain("skinTextLink: TokenCore_Color.blueBaseBlue700,")
    expect(brand).toContain("skinTextLink: TokenCore_Color.blueBaseBlue600,")
    expect(brand).not.toContain("Color(0x")
  })

  it("follows a semantic alias to its core token in the same mode", () => {
    const base = color("skinTextLink", "semantic", { literal: "#0161e7ff", ref: ramp.key }, { literal: "#2b7cfeff", ref: rampLight.key })
    const alias = color("buttonColorPrimaryNone", "semantic", { literal: "#0161e7ff", ref: base.key }, { literal: "#2b7cfeff", ref: base.key })
    const brand = content(writeDart(model([ramp, rampLight, base, alias])), "semantics/themes/brands/nt.gen.dart")

    const [dark, light] = brand.split("static const light")
    expect(dark).toContain("buttonColorPrimaryNone: TokenCore_Color.blueBaseBlue700,")
    expect(light).toContain("buttonColorPrimaryNone: TokenCore_Color.blueBaseBlue600,")
  })

  it("applies a brand override only to that brand", () => {
    const text = color("skinTextBrand", "semantic", { literal: "#0161e7ff", ref: ramp.key })
    text.brandOverrides.tdv = { dark: { literal: "#2b7cfeff", ref: rampLight.key }, light: { literal: "#2b7cfeff", ref: rampLight.key } }
    const result = writeDart(model([ramp, rampLight, text], ["nt", "tdv"]))

    expect(content(result, "semantics/themes/brands/nt.gen.dart")).toContain("skinTextBrand: TokenCore_Color.blueBaseBlue700,")
    expect(content(result, "semantics/themes/brands/tdv.gen.dart")).not.toContain("blueBaseBlue700")
    expect(content(result, "semantics/themes/brands/tdv.gen.dart")).toContain("class TokenSemanticTheme_Brand_TDV")
  })

  it("falls back to the literal and reports a broken reference", () => {
    const broken = color("skinTextPrimary", "semantic", { literal: "#ffffffff", ref: "doesNotExist" })
    const result = writeDart(model([ramp, broken]))

    expect(content(result, "semantics/themes/brands/nt.gen.dart")).toContain("skinTextPrimary: Color(0xffffffff),")
    expect(result.notes).toContain("unresolved reference skinTextPrimary -> doesNotExist; used literal")
  })

  it("shapes StrataThemeData from the groups that exist", () => {
    const button = color("buttonColorBuyHigh", "semantic", { literal: "#0161e7ff", ref: ramp.key })
    const theme = content(writeDart(model([ramp, button])), "semantics/theme.gen.dart")

    expect(theme).toContain("final TokenSemantic_Button button;")
    expect(theme).not.toContain("TokenSemantic_Field")
    expect(theme).toContain("buttonColorBuyHigh: Color.lerp(buttonColorBuyHigh, other.buttonColorBuyHigh, t)!,")
    expect(theme).toContain("'buttonColorBuyHigh': buttonColorBuyHigh,")
  })

  it("generates a StrataBrand enum over every brand", () => {
    const text = color("skinTextBrand", "semantic", { literal: "#0161e7ff", ref: ramp.key })
    const brands = content(writeDart(model([ramp, text], ["nt", "tdv"])), "semantics/themes/brands.gen.dart")

    expect(brands).toContain("  nt(TokenSemanticTheme_Brand_NT.dark, TokenSemanticTheme_Brand_NT.light),")
    expect(brands).toContain("  tdv(TokenSemanticTheme_Brand_TDV.dark, TokenSemanticTheme_Brand_TDV.light);")
  })

  it("refuses two tokens that shorten to the same member", () => {
    const a = color("radiusRadiusXs", "core", { literal: "#000000ff" })
    const b = color("radiusXs", "core", { literal: "#000000ff" })
    expect(() => writeDart(model([a, b]))).toThrow(/collision/)
  })

  it("records every token in the manifest with its Supernova id", () => {
    const text = color("skinTextLink", "semantic", { literal: "#0161e7ff", ref: ramp.key })
    const manifest = JSON.parse(content(writeDart(model([ramp, text])), "manifest.gen.json"))

    expect(manifest.tokens).toContainEqual({
      key: "skinTextLink",
      dart: "TokenSemantic_Theme.skinTextLink",
      sourceId: "id-skinTextLink",
      layer: "semantic",
      kind: "color",
      collection: "test",
    })
  })
})

describe("writeDart gradients", () => {
  const orange = color("orangeBaseOrange700", "core", { literal: "#ff4200ff" })
  const pink = color("pinkBoldPink600", "core", { literal: "#ed35feff" })
  const stop1 = color("skinGradientBrandMainStop01", "semantic", { literal: "#ff4200ff", ref: orange.key }, { literal: "#0161e7ff", ref: ramp.key })
  const stop2 = color("skinGradientBrandMainStop02", "semantic", { literal: "#ed35feff", ref: pink.key })
  stop1.brandOverrides.tdv = { dark: { literal: "#2b7cfeff", ref: rampLight.key } }
  const gradientValue = {
    type: "linear" as const,
    angle: 156,
    stops: [
      { color: { literal: "#ff4200ff", ref: stop1.key }, position: 0.2 },
      { color: { literal: "#ed35feff", ref: stop2.key }, position: 1 },
    ],
  }
  const main: ModelToken = {
    key: "gradientBrandMain",
    sourceId: "id-gradientBrandMain",
    kind: "gradient",
    layer: "semantic",
    collection: "test",
    values: { dark: { literal: "" }, light: { literal: "" } },
    brandOverrides: {},
    gradient: { values: { dark: gradientValue, light: gradientValue }, brandOverrides: {} },
  }
  const result = writeDart(model([ramp, rampLight, orange, pink, stop1, stop2, main], ["nt", "tdv"]))

  it("adds a gradient group to StrataThemeData with lerp and a CSS comment", () => {
    const theme = content(result, "semantics/theme.gen.dart")

    expect(theme).toContain("import 'package:flutter/painting.dart';")
    expect(theme).toContain("final class TokenSemantic_Gradient {")
    expect(theme).toContain(
      "  /// CSS: `linear-gradient(156deg, var(--skin-gradient-brand-main-stop-01) 20%, var(--skin-gradient-brand-main-stop-02) 100%)`\n  final LinearGradient gradientBrandMain;",
    )
    expect(theme).toContain("gradientBrandMain: LinearGradient.lerp(gradientBrandMain, other.gradientBrandMain, t)!,")
    expect(theme).toContain("  Map<String, LinearGradient> get values => {")
    expect(theme).toContain("  final TokenSemantic_Gradient gradient;")
    expect(theme).toContain("        gradient: gradient.lerp(other.gradient, t),")
  })

  it("builds each stop from the same colour expression as its theme field, per brand and mode", () => {
    const nt = content(result, "semantics/themes/brands/nt.gen.dart")
    const tdv = content(result, "semantics/themes/brands/tdv.gen.dart")
    const [ntDark, ntLight] = nt.split("static const light")
    const [tdvDark] = tdv.split("static const light")
    const line = (colors: string) =>
      `gradientBrandMain: LinearGradient(begin: Alignment(-0.537, -1.2061), end: Alignment(0.537, 1.2061), colors: [${colors}], stops: [0.2, 1.0]),`

    expect(nt).toContain("import 'package:flutter/painting.dart';")
    expect(ntDark).toContain(line("TokenCore_Color.orangeBaseOrange700, TokenCore_Color.pinkBoldPink600"))
    expect(ntLight).toContain(line("TokenCore_Color.blueBaseBlue700, TokenCore_Color.pinkBoldPink600"))
    expect(tdvDark).toContain(line("TokenCore_Color.blueBaseBlue600, TokenCore_Color.pinkBoldPink600"))
  })

  it("falls back to the literal for a stop with no colour token and reports it", () => {
    const loose: ModelToken = {
      ...main,
      key: "gradientLoose",
      gradient: {
        values: {
          dark: { ...gradientValue, stops: [{ color: { literal: "#000000ff" }, position: 0 }, ...gradientValue.stops] },
          light: gradientValue,
        },
        brandOverrides: {},
      },
    }
    const out = writeDart(model([ramp, rampLight, orange, pink, stop1, stop2, loose]))

    expect(content(out, "semantics/themes/brands/nt.gen.dart")).toContain("colors: [Color(0xff000000), TokenCore_Color.orangeBaseOrange700")
    expect(out.notes).toContain("gradient gradientLoose: stop colour is a literal")
  })

  it("records gradients in the manifest", () => {
    const manifest = JSON.parse(content(result, "manifest.gen.json"))
    expect(manifest.tokens).toContainEqual(
      expect.objectContaining({ key: "gradientBrandMain", dart: "TokenSemantic_Gradient.gradientBrandMain", kind: "gradient" }),
    )
  })

  it("leaves StrataThemeData unchanged when the model has no gradients", () => {
    const theme = content(writeDart(model([ramp])), "semantics/theme.gen.dart")
    expect(theme).not.toContain("TokenSemantic_Gradient")
    expect(theme).not.toContain("package:flutter/painting.dart")
  })
})
