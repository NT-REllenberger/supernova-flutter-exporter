/**
 * Exporter configuration. Defaults live in `config.json`; a pipeline can
 * override them.
 */
export type ExporterConfiguration = {
  /** When enabled, write only discovery.json describing collections, brands, and themes */
  discoveryOnly: boolean
  /** Display name of the dark themes. The root one is matched by codeName first. */
  darkThemeName: string
  /** Display name of the light themes. The root one is matched by codeName first. */
  lightThemeName: string
}
