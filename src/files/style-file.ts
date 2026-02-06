import { OutputTextFile, Token, TokenGroup, TokenType, TokenTheme } from "@supernovaio/sdk-exporters"
import { ExporterConfiguration } from "../../config"
import { tokenName, resetTokenNameTracking } from "../content/token"
import { tokenValueToFlutter } from "../content/formatters"
import { DEFAULT_STYLE_FILE_NAMES, DEFAULT_CLASS_NAMES, FLUTTER_IMPORT_TYPES } from "../constants/defaults"

/**
 * Creates a text output file for the Supernova export engine.
 */
function createTextFile(relativePath: string, fileName: string, content: string): OutputTextFile {
  return {
    path: relativePath,
    name: fileName,
    type: "text" as any,
    content: content,
  }
}

/**
 * Adds a disclaimer comment block at the top of file content.
 */
function addDisclaimer(disclaimer: string, content: string): string {
  const lines = disclaimer
    .trim()
    .split("\n")
    .map((line) => `// ${line}`)
    .join("\n")
  return `${lines}\n\n${content}`
}

/**
 * Adds a triple-slash documentation comment.
 */
function formatDescription(description: string, indent: string): string {
  return description
    .trim()
    .split("\n")
    .map((line) => `${indent}/// ${line}`)
    .join("\n")
}

/**
 * Filters tokens that are overridden in a given theme.
 */
function filterThemedTokens(tokens: Array<Token>, theme: TokenTheme): Array<Token> {
  const overriddenIds = new Set(theme.overriddenTokens.map((t) => t.id))
  return tokens.filter((t) => overriddenIds.has(t.id))
}

/**
 * Generates a Dart style file for a specific token type.
 *
 * Produces output like:
 * ```dart
 * import 'package:flutter/material.dart';
 *
 * class AppColors {
 *   static const primary = Color(0xff0000ff);
 *   AppColors._();
 * }
 * ```
 *
 * @param type - The token type to generate (Color, Typography, etc.)
 * @param tokens - All tokens (already filtered by brand if applicable)
 * @param tokenGroups - All token groups for name generation
 * @param config - The exporter configuration
 * @param themePath - Subdirectory for themed tokens (empty string for base)
 * @param theme - Theme being exported (for filtering themed-only tokens)
 * @returns OutputTextFile or null if no tokens / should be skipped
 */
export function styleOutputFile(
  type: TokenType,
  tokens: Array<Token>,
  tokenGroups: Array<TokenGroup>,
  config: ExporterConfiguration,
  themePath: string = "",
  theme?: TokenTheme
): OutputTextFile | null {
  // Reset name tracking for each file to avoid cross-file collisions
  resetTokenNameTracking()

  // Skip base files if not configured to export them
  if (!config.exportBaseValues && !themePath) {
    return null
  }

  // Filter to only tokens of this type
  let tokensOfType = tokens.filter((token) => token.tokenType === type)

  // For themed files: optionally filter to only overridden tokens
  if (themePath && theme && config.exportOnlyThemedTokens) {
    tokensOfType = filterThemedTokens(tokensOfType, theme)
    if (tokensOfType.length === 0) {
      return null
    }
  }

  // Skip empty files unless configured otherwise
  if (!config.generateEmptyFiles && tokensOfType.length === 0) {
    return null
  }

  // Build class name
  const className = `${config.classNamePrefix}${DEFAULT_CLASS_NAMES[type] ?? type}`

  // Build token declarations
  const declarations = tokensOfType
    .map((token) => {
      const name = tokenName(token, tokenGroups, config.tokenNameStyle)
      const value = tokenValueToFlutter(token)
      let decl = ""

      if (config.showDescriptions && token.description) {
        decl += formatDescription(token.description, "  ") + "\n"
      }

      decl += `  static const ${name} = ${value};`
      return decl
    })
    .join("\n\n")

  // Determine if we need the flutter/material.dart import
  const needsFlutterImport = FLUTTER_IMPORT_TYPES.has(type)

  // Assemble file content
  let content = ""

  if (needsFlutterImport) {
    content += "import 'package:flutter/material.dart';\n\n"
  }

  content += `class ${className} {\n`

  if (declarations) {
    content += declarations + "\n\n"
  }

  content += `  ${className}._();\n`
  content += "}\n"

  // Add disclaimer
  if (config.showGeneratedFileDisclaimer) {
    content = addDisclaimer(config.disclaimer, content)
  }

  // Determine file name and path
  const fileName = config.styleFileNames[type] ?? DEFAULT_STYLE_FILE_NAMES[type] ?? `${type.toLowerCase()}.dart`
  const relativePath = themePath ? `./${themePath}` : config.baseStyleFilePath

  return createTextFile(relativePath, fileName, content)
}
