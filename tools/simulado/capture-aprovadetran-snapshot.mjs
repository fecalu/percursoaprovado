import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DEFAULT_PAGE_URL, extractQuestionsFromPage } from './aprovadetran-lib.mjs'

const ARCHIVE_DIR = path.resolve('tools', 'simulado', 'archive')
const CATALOG_PATH = path.resolve('tools', 'simulado', 'output', 'aprovadetran-catalog.json')

function timestampForFile(date = new Date()) {
  const pad = value => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('')
}

async function loadCatalog() {
  try {
    return JSON.parse(await readFile(CATALOG_PATH, 'utf8'))
  } catch {
    return {
      source: 'APROVADETRAN',
      createdAt: new Date().toISOString(),
      runs: [],
      questoes: [],
    }
  }
}

async function main() {
  const snapshot = await extractQuestionsFromPage(DEFAULT_PAGE_URL)
  const catalog = await loadCatalog()
  const byFingerprint = new Map(catalog.questoes.map(item => [item.fingerprint, item]))
  const timestamp = timestampForFile()

  await mkdir(ARCHIVE_DIR, { recursive: true })
  await mkdir(path.dirname(CATALOG_PATH), { recursive: true })

  const archivePath = path.join(ARCHIVE_DIR, `aprovadetran-${timestamp}.json`)
  await writeFile(archivePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')

  let novas = 0
  let repetidas = 0

  for (const questao of snapshot.questoes) {
    if (byFingerprint.has(questao.fingerprint)) {
      repetidas += 1
      continue
    }

    byFingerprint.set(questao.fingerprint, {
      ...questao,
      firstSeenAt: snapshot.extractedAt,
      firstSeenSourcePage: snapshot.pageUrl,
    })
    novas += 1
  }

  catalog.lastUpdatedAt = new Date().toISOString()
  catalog.runs.push({
    extractedAt: snapshot.extractedAt,
    pageUrl: snapshot.pageUrl,
    totalCapturadas: snapshot.total,
    novas,
    repetidas,
    archivePath,
  })
  catalog.questoes = [...byFingerprint.values()]

  await writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')

  console.log(`Snapshot salvo em: ${archivePath}`)
  console.log(`Catalogo atualizado em: ${CATALOG_PATH}`)
  console.log(`Capturadas: ${snapshot.total}`)
  console.log(`Novas: ${novas}`)
  console.log(`Repetidas: ${repetidas}`)
  console.log(`Catalogo unico: ${catalog.questoes.length}`)
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
