import { OutputTextFile, Token, TokenType, TokenTheme } from "@supernovaio/sdk-exporters"
import { ExporterConfiguration } from "../../config"
import { DEFAULT_STYLE_FILE_NAMES } from "../constants/defaults"

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
 * Generates a Dart barrel file that re-exports all style files.
 *
 * Output example:
 * ```dart
 * // Base tokens
 * export 'base/colors.dart';
 * export 'base/text_styles.dart';
 *
 * // Theme: dark
 * export 'dark/colors.dart';
 * export 'dark/text_styles.dart';
 * ```
 *
 * @param tokens - All tokens (to determine which types have content)
 * @param config - The exporter configuration
 * @param themePaths - Array of theme directory names that were generated
 * @returns OutputTextFile or null if barrel generation is disabled
 */
export function barrelOutputFile(
  tokens: Array<Token>,
  config: ExporterConfiguration,
  themePaths: Array<{ path: string; label: string }>
): OutputTextFile | null {
  if (!config.generateBarrelFile) {
    return null
  }

  // Determine which token types have actual tokens
  const usedTokenTypes = new Set(tokens.map((t) => t.tokenType))

  const exports: string[] = []

  // Base token exports
  if (config.exportBaseValues) {
    const basePath = config.baseStyleFilePath.replace(/^\.\//, "")
    exports.push("// Base tokens")
    Object.values(TokenType)
      .filter((type) => usedTokenTypes.has(type))
      .forEach((type) => {
        const fileName = config.styleFileNames[type] ?? DEFAULT_STYLE_FILE_NAMES[type]
        if (fileName) {
          exports.push(`export '${basePath}/${fileName}';`)
        }
      })
  }

  // Theme exports
  for (const theme of themePaths) {
    exports.push("")
    exports.push(`// Theme: ${theme.label}`)
    Object.values(TokenType)
      .filter((type) => usedTokenTypes.has(type))
      .forEach((type) => {
        const fileName = config.styleFileNames[type] ?? DEFAULT_STYLE_FILE_NAMES[type]
        if (fileName) {
          exports.push(`export '${theme.path}/${fileName}';`)
        }
      })
  }

  let content = exports.join("\n") + "\n"

  if (config.showGeneratedFileDisclaimer) {
    content = addDisclaimer(config.disclaimer, content)
  }

  return createTextFile("./", config.barrelFileName, content)
}
