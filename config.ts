import { TokenType } from "@supernovaio/sdk-exporters"

/**
 * How themes are exported in the generated files.
 */
export enum ThemeExportStyle {
  /** Apply themes directly to base token values (single set of files) */
  ApplyDirectly = "applyDirectly",
  /** Generate separate files per theme in subdirectories */
  SeparateFiles = "separateFiles",
}

/**
 * Supported token name casing styles.
 */
export enum TokenNameStyle {
  CamelCase = "camelCase",
  PascalCase = "pascalCase",
  SnakeCase = "snakeCase",
  ConstantCase = "constantCase",
}

/**
 * Main configuration of the exporter - type interface.
 * Default values are set through `config.json` and users can override
 * the behavior when creating pipelines.
 */
export type ExporterConfiguration = {
  /** When enabled, a disclaimer will appear at the top of all generated files */
  showGeneratedFileDisclaimer: boolean
  /** The disclaimer text to include */
  disclaimer: string
  /** When enabled, token description will be shown as doc comments for every exported token */
  showDescriptions: boolean
  /** When enabled, empty style files will be generated. Otherwise empty files are omitted */
  generateEmptyFiles: boolean
  /** When enabled, a barrel file re-exporting all style files will be generated */
  generateBarrelFile: boolean
  /** Style of exported token names */
  tokenNameStyle: TokenNameStyle
  /** Prefix for generated Dart class names (e.g. "App" -> AppColors) */
  classNamePrefix: string
  /** All base files will be written to this directory (relative to export root) */
  baseStyleFilePath: string
  /** Controls how themes are exported */
  exportThemesAs: ThemeExportStyle
  /** When enabled, base token values will be exported along with themes */
  exportBaseValues: boolean
  /** When enabled, themed files will only include tokens that differ from base */
  exportOnlyThemedTokens: boolean
  /** Name of each file that will be generated, grouped by token type */
  styleFileNames: Record<string, string>
  /** Name of the barrel file */
  barrelFileName: string
}
