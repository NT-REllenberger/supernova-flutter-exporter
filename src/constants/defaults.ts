import { TokenType } from "@supernovaio/sdk-exporters"

/** Default file names for each token type */
export const DEFAULT_STYLE_FILE_NAMES: Record<string, string> = {
  [TokenType.color]: "colors.dart",
  [TokenType.typography]: "text_styles.dart",
  [TokenType.shadow]: "shadows.dart",
  [TokenType.gradient]: "gradients.dart",
  [TokenType.border]: "borders.dart",
  "BorderRadius": "border_radii.dart",
  [TokenType.borderWidth]: "border_widths.dart",
  [TokenType.dimension]: "dimensions.dart",
  [TokenType.size]: "sizes.dart",
  [TokenType.space]: "spaces.dart",
  [TokenType.opacity]: "opacities.dart",
  [TokenType.fontSize]: "font_sizes.dart",
  [TokenType.fontWeight]: "font_weights.dart",
  [TokenType.fontFamily]: "font_families.dart",
  [TokenType.lineHeight]: "line_heights.dart",
  [TokenType.letterSpacing]: "letter_spacings.dart",
  [TokenType.paragraphSpacing]: "paragraph_spacings.dart",
  [TokenType.duration]: "durations.dart",
  [TokenType.zIndex]: "z_indices.dart",
  [TokenType.string]: "strings.dart",
  [TokenType.productCopy]: "product_copy.dart",
  [TokenType.textCase]: "text_cases.dart",
  [TokenType.textDecoration]: "text_decorations.dart",
  [TokenType.visibility]: "visibilities.dart",
  [TokenType.blur]: "blurs.dart",
}

/** Default Dart class names for each token type */
export const DEFAULT_CLASS_NAMES: Record<string, string> = {
  [TokenType.color]: "Colors",
  [TokenType.typography]: "TextStyles",
  [TokenType.shadow]: "Shadows",
  [TokenType.gradient]: "Gradients",
  [TokenType.border]: "Borders",
  "BorderRadius": "BorderRadii",
  [TokenType.borderWidth]: "BorderWidths",
  [TokenType.dimension]: "Dimensions",
  [TokenType.size]: "Sizes",
  [TokenType.space]: "Spaces",
  [TokenType.opacity]: "Opacities",
  [TokenType.fontSize]: "FontSizes",
  [TokenType.fontWeight]: "FontWeights",
  [TokenType.fontFamily]: "FontFamilies",
  [TokenType.lineHeight]: "LineHeights",
  [TokenType.letterSpacing]: "LetterSpacings",
  [TokenType.paragraphSpacing]: "ParagraphSpacings",
  [TokenType.duration]: "Durations",
  [TokenType.zIndex]: "ZIndices",
  [TokenType.string]: "Strings",
  [TokenType.productCopy]: "ProductCopy",
  [TokenType.textCase]: "TextCases",
  [TokenType.textDecoration]: "TextDecorations",
  [TokenType.visibility]: "Visibilities",
  [TokenType.blur]: "Blurs",
}

/** Token types that need `import 'package:flutter/material.dart';` */
export const FLUTTER_IMPORT_TYPES: Set<string> = new Set([
  TokenType.color,
  TokenType.typography,
  TokenType.shadow,
  TokenType.gradient,
  TokenType.border,
  TokenType.radius,
])
