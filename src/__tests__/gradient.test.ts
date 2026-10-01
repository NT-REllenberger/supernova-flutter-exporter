import { describe, expect, it } from "vitest"

import { dartAlignments } from "../dart/naming"
import { cssAngleFromHandles, cssForGradient, keyToCssVar } from "../gradient"

describe("cssAngleFromHandles", () => {
  it("matches export-helpers for the axis directions", () => {
    expect(cssAngleFromHandles({ x: 0.5, y: 1 }, { x: 0.5, y: 0 })).toBe(0)
    expect(cssAngleFromHandles({ x: 0, y: 0.5 }, { x: 1, y: 0.5 })).toBe(90)
    expect(cssAngleFromHandles({ x: 0.5, y: 0 }, { x: 0.5, y: 1 })).toBe(180)
    expect(cssAngleFromHandles({ x: 1, y: 0.5 }, { x: 0, y: 0.5 })).toBe(270)
  })

  it("reads 156deg from handles pointing down and to the right", () => {
    const rad = (156 * Math.PI) / 180
    const to = { x: 0.5 + 0.5 * Math.sin(rad), y: 0.5 - 0.5 * Math.cos(rad) }
    const from = { x: 1 - to.x, y: 1 - to.y }
    expect(cssAngleFromHandles(from, to)).toBe(156)
  })
})

describe("cssForGradient", () => {
  it("writes the CSS web ships, with var() names for the stop colours", () => {
    const css = cssForGradient({
      type: "linear",
      angle: 156,
      stops: [
        { color: { literal: "#ff4200ff", ref: "skinGradientBrandMainStop01" }, position: 0.2 },
        { color: { literal: "#ed35feff", ref: "skinGradientBrandMainStop02" }, position: 1 },
      ],
    })
    expect(css).toBe(
      "linear-gradient(156deg, var(--skin-gradient-brand-main-stop-01) 20%, var(--skin-gradient-brand-main-stop-02) 100%)",
    )
  })

  it("names CSS variables as web does", () => {
    expect(keyToCssVar("skinGradientBrandMktReplayStop02")).toBe("skin-gradient-brand-mkt-replay-stop-02")
    expect(keyToCssVar("neutralCoolNeutral025")).toBe("neutral-cool-neutral-025")
  })
})

describe("dartAlignments", () => {
  it("maps 90deg to left -> right", () => {
    expect(dartAlignments(90)).toEqual({ begin: "Alignment.centerLeft", end: "Alignment.centerRight" })
  })

  it("maps 180deg to top -> bottom", () => {
    expect(dartAlignments(180)).toEqual({ begin: "Alignment.topCenter", end: "Alignment.bottomCenter" })
  })

  it("maps 156deg to a line that reaches the corners of a square box", () => {
    // sin 156 = 0.4067, cos 156 = -0.9135, k = |sin| + |cos| = 1.3203.
    expect(dartAlignments(156)).toEqual({ begin: "Alignment(-0.537, -1.2061)", end: "Alignment(0.537, 1.2061)" })

    // On a square box the end point's projection on the direction is half
    // the CSS gradient length, |sin| + |cos| (in half-side units).
    const rad = (156 * Math.PI) / 180
    const [x, y] = [0.537, 1.2061]
    const projection = x * Math.sin(rad) - y * Math.cos(rad)
    expect(projection).toBeCloseTo(Math.abs(Math.sin(rad)) + Math.abs(Math.cos(rad)), 3)
  })
})
