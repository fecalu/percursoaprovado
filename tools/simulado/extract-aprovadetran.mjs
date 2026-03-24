import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DEFAULT_PAGE_URL, extractQuestionsFromPage } from './aprovadetran-lib.mjs'

const DEFAULT_OUTPUT = path.resolve('tools', 'simulado', 'output', 'aprovadetran-questoes.json')

function getArg(flag) {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : null
}

const pageUrl = getArg('--page') || DEFAULT_PAGE_URL
const outputPath = path.resolve(getArg('--output') || DEFAULT_OUTPUT)

async function main() {
  const extracted = await extractQuestionsFromPage(pageUrl)

  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(
    outputPath,
    `${JSON.stringify(
      extracted,
      null,
      2,
    )}\n`,
    'utf8',
  )

  console.log(`Questoes extraidas: ${extracted.total}`)
  console.log(`Arquivo salvo em: ${outputPath}`)
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
