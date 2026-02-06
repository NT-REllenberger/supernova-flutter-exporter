import {
  Token,
  TokenType,
  ColorToken,
  ColorTokenValue,
  TypographyToken,
  ShadowToken,
  ShadowTokenValue,
  GradientToken,
  GradientTokenValue,
  BorderToken,
  BorderTokenValue,
} from "@supernovaio/sdk-exporters"

// --- Color ---

/**
 * Converts a ColorTokenValue to Flutter Color(0xAARRGGBB) format.
 */
export function colorToFlutter(value: ColorTokenValue): string {
  const r = value.color.r
  const g = value.color.g
  const b = value.color.b
  const a = Math.round(value.opacity.measure * 255)

  const hex = [a, r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")
  return `Color(0x${hex})`
}

// --- Typography ---

/**
 * Maps a font weight string (e.g. "400", "Bold") to the nearest Flutter FontWeight.
 */
function fontWeightToFlutter(weight: string): string {
  const w = parseInt(weight, 10)
  if (!isNaN(w)) {
    // Clamp to nearest 100
    const clamped = Math.round(w / 100) * 100
    return `FontWeight.w${Math.max(100, Math.min(900, clamped))}`
  }

  // Named weights
  const map: Record<string, string> = {
    thin: "FontWeight.w100",
    extralight: "FontWeight.w200",
    light: "FontWeight.w300",
    regular: "FontWeight.w400",
    normal: "FontWeight.w400",
    medium: "FontWeight.w500",
    semibold: "FontWeight.w600",
    bold: "FontWeight.w700",
    extrabold: "FontWeight.w800",
    black: "FontWeight.w900",
  }
  return map[weight.toLowerCase()] ?? "FontWeight.w400"
}

/**
 * Maps a text decoration string to Flutter TextDecoration.
 */
function textDecorationToFlutter(decoration: string): string {
  switch (decoration) {
    case "Underline":
      return "TextDecoration.underline"
    case "Strikethrough":
      return "TextDecoration.lineThrough"
    default:
      return "TextDecoration.none"
  }
}

/**
 * Detects if a font weight string suggests italic.
 */
function isItalicWeight(weight: string): boolean {
  return weight.toLowerCase().includes("italic")
}

/**
 * Converts a TypographyToken to Flutter TextStyle(...) format.
 */
export function typographyToFlutter(token: TypographyToken): string {
  const v = token.value
  const fontFamily = v.fontFamily.text
  const fontWeight = fontWeightToFlutter(v.fontWeight.text)
  const fontStyle = isItalicWeight(v.fontWeight.text) ? "FontStyle.italic" : "FontStyle.normal"
  const fontSize = v.fontSize.measure
  const decoration = textDecorationToFlutter(v.textDecoration.value)

  // Letter spacing: convert from percentage to absolute if needed
  let letterSpacing = v.letterSpacing.measure
  if (v.letterSpacing.unit === ("Percent" as any)) {
    letterSpacing = (fontSize / 100) * letterSpacing
  }

  // Line height: convert to multiplier
  let heightLine = ""
  if (v.lineHeight) {
    let lh: number
    if (v.lineHeight.unit === ("Pixels" as any)) {
      lh = v.lineHeight.measure / fontSize
    } else if (v.lineHeight.unit === ("Percent" as any)) {
      lh = v.lineHeight.measure / 100
    } else {
      lh = v.lineHeight.measure
    }
    heightLine = `\n    height: ${lh},`
  }

  return [
    "TextStyle(",
    `    fontFamily: "${fontFamily}",`,
    `    fontWeight: ${fontWeight},`,
    `    fontStyle: ${fontStyle},`,
    `    fontSize: ${fontSize},`,
    `    decoration: ${decoration},`,
    `    letterSpacing: ${letterSpacing},`,
    heightLine ? `${heightLine}` : null,
    "    leadingDistribution: TextLeadingDistribution.even,",
    "  )",
  ]
    .filter((l) => l !== null)
    .join("\n  ")
}

// --- Shadow ---

/**
 * Converts a ShadowTokenValue to Flutter BoxShadow(...) format.
 */
export function shadowToFlutter(value: ShadowTokenValue): string {
  const color = colorToFlutter(value.color)
  return [
    "BoxShadow(",
    `    color: ${color},`,
    `    offset: Offset(${value.x}, ${value.y}),`,
    `    blurRadius: ${value.radius},`,
    `    spreadRadius: ${value.spread},`,
    "  )",
  ].join("\n  ")
}

/**
 * Converts an array of ShadowTokenValue (multi-layer) to a list literal.
 */
export function shadowArrayToFlutter(values: ShadowTokenValue[]): string {
  if (values.length === 1) {
    return shadowToFlutter(values[0])
  }
  const items = values.map((v) => `    ${shadowToFlutter(v)}`).join(",\n")
  return `[\n${items},\n  ]`
}

// --- Gradient ---

/**
 * Converts a point {x, y} (0-1 range) to Flutter Alignment.
 */
function pointToAlignment(x: number, y: number): string {
  const ax = (x - 0.5) * 2
  const ay = (y - 0.5) * 2
  return `Alignment(${ax}, ${ay})`
}

/**
 * Converts a GradientTokenValue to Flutter LinearGradient(...) format.
 */
export function gradientToFlutter(value: GradientTokenValue): string {
  const begin = pointToAlignment(value.from.x, value.from.y)
  const end = pointToAlignment(value.to.x, value.to.y)

  const stops = value.stops.map((s) => `      ${s.position}`).join(",\n")
  const colors = value.stops.map((s) => `      ${colorToFlutter(s.color)}`).join(",\n")

  return [
    "LinearGradient(",
    `    begin: ${begin},`,
    `    end: ${end},`,
    `    stops: [`,
    stops + ",",
    "    ],",
    "    colors: [",
    colors + ",",
    "    ],",
    "  )",
  ].join("\n  ")
}

/**
 * Converts an array of GradientTokenValue (multi-layer) to a list literal.
 */
export function gradientArrayToFlutter(values: GradientTokenValue[]): string {
  if (values.length === 1) {
    return gradientToFlutter(values[0])
  }
  const items = values.map((v) => `    ${gradientToFlutter(v)}`).join(",\n")
  return `[\n${items},\n  ]`
}

// --- Border ---

/**
 * Converts a BorderTokenValue to Flutter Border.fromBorderSide(BorderSide(...)) format.
 */
export function borderToFlutter(value: BorderTokenValue): string {
  const color = colorToFlutter(value.color)
  return [
    "Border.fromBorderSide(BorderSide(",
    `    color: ${color},`,
    `    width: ${value.width.measure},`,
    "  ))",
  ].join("\n  ")
}

/**
 * Converts a BorderTokenValue to Flutter BorderSide(...) format.
 */
export function borderSideToFlutter(value: BorderTokenValue): string {
  const color = colorToFlutter(value.color)
  return [
    "BorderSide(",
    `    color: ${color},`,
    `    width: ${value.width.measure},`,
    "  )",
  ].join("\n  ")
}

// --- Radius ---

/**
 * Converts a radius measure to Flutter BorderRadius.
 */
export function radiusToFlutter(measure: number): string {
  return `BorderRadius.all(Radius.circular(${measure}))`
}

// --- Generic dimension ---

/**
 * Converts a dimension measure to a raw double value.
 */
export function dimensionToFlutter(measure: number): string {
  return measure.toString()
}

// --- Main dispatcher ---

/**
 * Converts any token to its Flutter string representation.
 */
export function tokenValueToFlutter(token: Token): string {
  switch (token.tokenType) {
    case TokenType.color:
      return colorToFlutter((token as ColorToken).value)

    case TokenType.typography:
      return typographyToFlutter(token as TypographyToken)

    case TokenType.shadow: {
      const shadowToken = token as ShadowToken
      const values = shadowToken.value as unknown as ShadowTokenValue[]
      if (Array.isArray(values)) {
        return shadowArrayToFlutter(values)
      }
      return shadowToFlutter(values as unknown as ShadowTokenValue)
    }

    case TokenType.gradient: {
      const gradientToken = token as GradientToken
      const values = gradientToken.value as unknown as GradientTokenValue[]
      if (Array.isArray(values)) {
        return gradientArrayToFlutter(values)
      }
      return gradientToFlutter(values as unknown as GradientTokenValue)
    }

    case TokenType.border: {
      const borderToken = token as BorderToken
      return borderToFlutter(borderToken.value as unknown as BorderTokenValue)
    }

    case TokenType.radius: {
      const val = (token as any).value
      return radiusToFlutter(val.measure ?? val.radius?.measure ?? 0)
    }

    // All dimension-like types: raw numeric value
    case TokenType.dimension:
    case TokenType.size:
    case TokenType.space:
    case TokenType.opacity:
    case TokenType.fontSize:
    case TokenType.lineHeight:
    case TokenType.letterSpacing:
    case TokenType.paragraphSpacing:
    case TokenType.borderWidth:
    case TokenType.duration:
    case TokenType.zIndex:
      return dimensionToFlutter((token as any).value.measure)

    // String-like types
    case TokenType.string:
    case TokenType.productCopy:
    case TokenType.fontFamily:
    case TokenType.fontWeight:
      return `"${(token as any).value.text}"`

    // Option types
    case TokenType.textCase:
    case TokenType.textDecoration:
    case TokenType.visibility:
      return `"${(token as any).value.value}"`

    default:
      return `"unsupported token type: ${token.tokenType}"`
  }
}
