import {
  Supernova,
  PulsarContext,
  RemoteVersionIdentifier,
  AnyOutputFile,
  TokenType,
  TokenTheme,
} from "@supernovaio/sdk-exporters"
import { ExporterConfiguration, ThemeExportStyle } from "../config"
import { styleOutputFile } from "./files/style-file"
import { barrelOutputFile } from "./files/barrel-file"

/** Exporter configuration resolved from config.json defaults and user overrides */
export const exportConfiguration = Pulsar.exportConfig<ExporterConfiguration>()

/**
 * Filters out null values from an array of output files.
 */
function processOutputFiles(files: Array<AnyOutputFile | null>): Array<AnyOutputFile> {
  return files.filter((file): file is AnyOutputFile => file !== null)
}

/**
 * Converts a theme name to a safe directory name (camelCase, filesystem-safe).
 */
function themeToDirectoryName(theme: TokenTheme): string {
  const name = theme.codeName || theme.name
  return name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .map((word, i) => {
      if (i === 0) return word.toLowerCase()
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join("")
}

/**
 * Main export function that generates Dart files from design tokens.
 *
 * Handles:
 * - Fetching tokens and token groups from the design system
 * - Filtering tokens by brand if specified
 * - Processing themes (separate files per theme, or applied directly)
 * - Generating style files for each token type as Dart classes
 * - Creating a barrel file re-exporting everything
 */
Pulsar.export(async (sdk: Supernova, context: PulsarContext): Promise<Array<AnyOutputFile>> => {
  const remoteVersionIdentifier: RemoteVersionIdentifier = {
    designSystemId: context.dsId,
    versionId: context.versionId,
  }

  // Fetch tokens and token groups
  let tokens = await sdk.tokens.getTokens(remoteVersionIdentifier)
  let tokenGroups = await sdk.tokens.getTokenGroups(remoteVersionIdentifier)

  // Filter by brand if specified
  if (context.brandId) {
    const brands = await sdk.brands.getBrands(remoteVersionIdentifier)
    const brand = brands.find((b) => b.id === context.brandId || b.idInVersion === context.brandId)
    if (!brand) {
      throw new Error(`Unable to find brand ${context.brandId}.`)
    }
    tokens = tokens.filter((token) => token.brandId === brand.id)
    tokenGroups = tokenGroups.filter((group) => group.brandId === brand.id)
  }

  let outputFiles: Array<AnyOutputFile | null> = []
  const themePaths: Array<{ path: string; label: string }> = []

  // Process themes if specified
  if (context.themeIds && context.themeIds.length > 0) {
    const themes = await sdk.tokens.getTokenThemes(remoteVersionIdentifier)

    // Find and validate requested themes
    const themesToApply = context.themeIds.map((themeId) => {
      const theme = themes.find((t) => t.id === themeId || t.idInVersion === themeId)
      if (!theme) {
        throw new Error(`Unable to find theme ${themeId}`)
      }
      return theme
    })

    switch (exportConfiguration.exportThemesAs) {
      case ThemeExportStyle.SeparateFiles: {
        // Generate base files if configured
        if (exportConfiguration.exportBaseValues) {
          const baseFiles = Object.values(TokenType).map((type) =>
            styleOutputFile(type, tokens, tokenGroups, exportConfiguration)
          )
          outputFiles.push(...baseFiles)
        }

        // Generate separate themed files per theme
        for (const theme of themesToApply) {
          const themedTokens = sdk.tokens.computeTokensByApplyingThemes(tokens, tokens, [theme])
          const themeDirName = themeToDirectoryName(theme)

          themePaths.push({ path: themeDirName, label: theme.name })

          const themeFiles = Object.values(TokenType).map((type) =>
            styleOutputFile(type, themedTokens, tokenGroups, exportConfiguration, themeDirName, theme)
          )
          outputFiles.push(...themeFiles)
        }
        break
      }

      case ThemeExportStyle.ApplyDirectly: {
        // Apply all themes directly to tokens, output single set of files
        tokens = sdk.tokens.computeTokensByApplyingThemes(tokens, tokens, themesToApply)

        const files = Object.values(TokenType).map((type) =>
          styleOutputFile(type, tokens, tokenGroups, exportConfiguration)
        )
        outputFiles.push(...files)
        break
      }
    }
  } else {
    // No themes: generate base files only
    const files = Object.values(TokenType).map((type) =>
      styleOutputFile(type, tokens, tokenGroups, exportConfiguration)
    )
    outputFiles.push(...files)
  }

  // Generate barrel file
  const barrel = barrelOutputFile(tokens, exportConfiguration, themePaths)
  if (barrel) {
    outputFiles.push(barrel)
  }

  return processOutputFiles(outputFiles)
})
