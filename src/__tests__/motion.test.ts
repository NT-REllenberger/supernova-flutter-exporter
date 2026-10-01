import { describe, expect, it } from "vitest"

import { dartCurve, normalizeTimingFunction } from "../dart/naming"
import { writeDart } from "../dart/writer"
import { modelFromTokensJson } from "../local/tokens-json"

describe("easing", () => {
  it("maps Supernova labels like web compile-tokens", () => {
    expect(normalizeTimingFunction("ease in and out")).toBe("ease-in-out")
    expect(normalizeTimingFunction("Ease Out")).toBe("ease-out")
    expect(normalizeTimingFunction("linear")).toBe("linear")
  })

  it("writes CSS keywords as Cubic with CSS control points", () => {
    expect(dartCurve("ease-in-out")).toBe("Cubic(0.42, 0.0, 0.58, 1.0)")
    expect(dartCurve("ease in and out")).toBe("Cubic(0.42, 0.0, 0.58, 1.0)")
    expect(dartCurve("cubic-bezier(0.2, 0, 0, 1)")).toBe("Cubic(0.2, 0.0, 0.0, 1.0)")
    expect(dartCurve("linear")).toBe("Curves.linear")
    expect(() => dartCurve("bounce")).toThrow(/Unsupported easing/)
  })
})

describe("motion tokens", () => {
  const json = {
    collections: {
      other: {
        durationDurationFast: { type: "Duration", default: "50ms" },
        durationDurationHold: { type: "Duration", default: "1000ms" },
      },
      string: { easingEaseInOut: { type: "String", default: "ease in and out" } },
    },
  }

  it("reads durations in ms and easing labels as core tokens", () => {
    const { tokens } = modelFromTokensJson(json)
    const fast = tokens.find((t) => t.key === "durationDurationFast")!
    expect(fast).toMatchObject({ kind: "duration", layer: "core", values: { dark: { literal: 50 } } })
    expect(tokens.find((t) => t.key === "easingEaseInOut")?.values.dark.literal).toBe("ease-in-out")
  })

  it("emits core literals and a semantic set on the theme", () => {
    const { files } = writeDart(modelFromTokensJson(json))
    const core = files.find((f) => f.path === "core/" && f.name === "motion.gen.dart")!.content
    const semantic = files.find((f) => f.path === "semantics/" && f.name === "motion.gen.dart")!.content
    const theme = files.find((f) => f.name === "theme.gen.dart")!.content

    expect(core).toContain("import 'package:flutter/animation.dart';")
    expect(core).toContain("static const Duration durationFast = Duration(milliseconds: 50);")
    expect(core).toContain("static const Curve easingEaseInOut = Cubic(0.42, 0.0, 0.58, 1.0);")
    expect(semantic).toContain("final Duration durationFast;")
    expect(semantic).toContain("durationFast: TokenCore_Motion.durationFast,")
    expect(semantic).toContain("easingEaseInOut: t < 0.5 ? easingEaseInOut : other.easingEaseInOut,")
    expect(semantic).toContain("Map<String, Object> get values")
    expect(theme).toContain("final TokenSemantic_Motion motion;")
    expect(semantic).toContain("TokenSemantic_Motion get reduced => TokenSemantic_Motion(")
    expect(semantic).toContain("durationFast: Duration.zero,")
    expect(semantic).toContain("easingEaseInOut: easingEaseInOut,")
  })
})
