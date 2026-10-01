/**
 * NinjaTrader Strata — Supernova Flutter token exporter.
 *
 * Writes the `mobile_strata` token layout (`lib/src/tokens/`): core literals,
 * semantic density, the StrataThemeData shape, and one `.gen.dart` per brand
 * with dark and light instances. Theme and brand discovery follow
 * supernova-web-exporter so both platforms read Strata the same way.
 *
 * Point the pipeline destination at `packages/mobile_strata/lib/src/tokens`.
 */

import type { AnyOutputFile, RemoteVersionIdentifier } from "@supernovaio/sdk-exporters"
import { OutputFileType } from "@supernovaio/sdk-exporters"

import { ExporterConfiguration } from "../config"
import { writeDart } from "./dart/writer"
import { discoveryOutputFile } from "./files/discovery-file"
import { modelFromSdk } from "./sdk/adapter"

export const exportConfiguration = Pulsar.exportConfig<ExporterConfiguration>()

Pulsar.export(async (sdk, context): Promise<Array<AnyOutputFile>> => {
  const version: RemoteVersionIdentifier = { designSystemId: context.dsId, versionId: context.versionId }

  const [tokens, groups, themes, collections] = await Promise.all([
    sdk.tokens.getTokens(version),
    sdk.tokens.getTokenGroups(version),
    sdk.tokens.getTokenThemes(version),
    sdk.tokens.getTokenCollections(version),
  ])
  console.log(`[flutter-exporter] ${tokens.length} tokens, ${themes.length} themes, ${collections.length} collections`)

  if (exportConfiguration.discoveryOnly) {
    const brands = await sdk.brands.getBrands(version)
    return [discoveryOutputFile(context, brands, collections, themes, tokens)]
  }

  const model = modelFromSdk({
    tokens,
    groups,
    themes,
    collections,
    themeNames: { dark: exportConfiguration.darkThemeName, light: exportConfiguration.lightThemeName },
  })
  const { files, notes } = writeDart(model)
  // console.warn fails a Supernova build (web exporter NOTES.md), so notes use log.
  for (const note of notes) console.log(`[flutter-exporter] ${note}`)

  return files.map((f) => ({
    path: `./${f.path}`,
    name: f.name,
    content: f.content,
    type: OutputFileType.text,
  }))
})
