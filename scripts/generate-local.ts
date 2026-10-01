/**
 * Generate the Dart token files from a local tokens.json, without Supernova.
 *
 *   npx tsx scripts/generate-local.ts <tokens.json> <out-dir>
 *
 * <out-dir> is the package's `lib/src/tokens/`. Every `*.gen.*` file there is
 * replaced; hand-written files are left alone.
 */

import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { writeDart } from "../src/dart/writer"
import { modelFromTokensJson } from "../src/local/tokens-json"

function removeGenerated(dir: string): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) removeGenerated(full)
    else if (/\.gen\.(dart|json)$/.test(entry)) rmSync(full)
  }
}

const [, , input, outDir] = process.argv
if (!input || !outDir) {
  console.error("usage: tsx scripts/generate-local.ts <tokens.json> <out-dir>")
  process.exit(2)
}

const { files, notes } = writeDart(modelFromTokensJson(JSON.parse(readFileSync(input, "utf8"))))
mkdirSync(outDir, { recursive: true })
removeGenerated(outDir)
for (const f of files) {
  const dir = join(outDir, f.path)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, f.name), f.content)
}

console.log(`wrote ${files.length} file(s) to ${outDir}`)
for (const note of notes) console.log(`  note: ${note}`)
