import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { extractQuestionsFromPage } from './aprovadetran-lib.mjs'

const DEFAULT_OUTPUT = path.resolve('tools', 'simulado', 'output', 'aprovadetran-batch.json')

function getArg(flag) {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : null
}

const outputPath = path.resolve(getArg('--output') || DEFAULT_OUTPUT)

const stateRoutes = [
  'ac', 'al', 'ap', 'am', 'ba', 'ce', 'df', 'es', 'go', 'ma', 'mt', 'ms', 'mg',
  'pa', 'pb', 'pr', 'pe', 'pi', 'rj', 'rn', 'rs', 'ro', 'rr', 'sc', 'sp', 'se', 'to',
].map(state => `https://www.aprovadetran.com.br/simulado-detran-${state}`)

const pages = [
  'https://www.aprovadetran.com.br/simulado-detran/gratuito',
  'https://www.aprovadetran.com.br/simulado-detran',
  ...stateRoutes,
]

async function main() {
  const byFingerprint = new Map()
  const runs = []

  for (const pageUrl of pages) {
    try {
      const extracted = await extractQuestionsFromPage(pageUrl)
      runs.push({
        pageUrl,
        total: extracted.total,
        status: 'ok',
      })

      for (const questao of extracted.questoes) {
        if (!byFingerprint.has(questao.fingerprint)) {
          byFingerprint.set(questao.fingerprint, questao)
        }
      }
    } catch (error) {
      runs.push({
        pageUrl,
        total: 0,
        status: 'erro',
        detalhe: error.message,
      })
    }
  }

  const questoes = [...byFingerprint.values()]

  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        source: 'APROVADETRAN',
        extractedAt: new Date().toISOString(),
        totalPaginas: pages.length,
        totalUnicas: questoes.length,
        runs,
        questoes,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  console.log(`Paginas processadas: ${pages.length}`)
  console.log(`Questoes unicas: ${questoes.length}`)
  console.log(`Arquivo salvo em: ${outputPath}`)
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
