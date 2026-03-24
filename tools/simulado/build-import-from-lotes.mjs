import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const rootDir = process.cwd()
const lotesDir = path.join(rootDir, 'tools', 'simulado', 'lotes')
const outputDir = path.join(rootDir, 'tools', 'simulado', 'output')

function getArg(flag) {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : null
}

const outFile = path.resolve(
  getArg('--out') || path.join(outputDir, 'base-propria-oficial-300-questoes.json'),
)

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function validateAlternativas(questao, fileName) {
  assert(Array.isArray(questao.alternativas), `Alternativas ausentes em ${fileName}: ${questao.enunciado}`)
  assert(questao.alternativas.length === 4, `Questão sem 4 alternativas em ${fileName}: ${questao.enunciado}`)

  const corretas = questao.alternativas.filter(alternativa => alternativa.correta === true)
  assert(corretas.length === 1, `Questão sem exatamente 1 correta em ${fileName}: ${questao.enunciado}`)

  questao.alternativas.forEach((alternativa, index) => {
    assert(
      typeof alternativa.texto === 'string' && alternativa.texto.trim().length > 0,
      `Alternativa sem texto em ${fileName}: ${questao.enunciado}`,
    )
    assert(
      Number.isInteger(alternativa.ordem),
      `Alternativa sem ordem inteira em ${fileName}: ${questao.enunciado}`,
    )
    assert(
      alternativa.ordem === index,
      `Alternativa fora de ordem em ${fileName}: ${questao.enunciado}`,
    )
  })
}

function validateQuestao(questao, fileName) {
  const camposObrigatorios = [
    'enunciado',
    'tema',
    'dificuldade',
    'status',
    'explicacaoCurta',
    'origem',
    'origemQuestaoId',
    'fingerprint',
  ]

  camposObrigatorios.forEach(campo => {
    assert(
      typeof questao[campo] === 'string' && questao[campo].trim().length > 0,
      `Campo obrigatório ausente (${campo}) em ${fileName}: ${questao.enunciado || '[sem enunciado]'}`,
    )
  })

  assert(Number.isInteger(questao.ordemExibicao), `ordemExibicao inválida em ${fileName}: ${questao.enunciado}`)
  validateAlternativas(questao, fileName)
}

async function main() {
  const files = (await readdir(lotesDir))
    .filter(file => /^lote-\d+.*\.json$/i.test(file))
    .sort((left, right) => left.localeCompare(right, 'pt-BR'))

  assert(files.length > 0, 'Nenhum lote encontrado em tools/simulado/lotes.')

  const origemQuestaoIds = new Set()
  const fingerprints = new Set()
  const temas = new Map()
  const questoes = []
  const lotes = []

  for (const fileName of files) {
    const filePath = path.join(lotesDir, fileName)
    const raw = JSON.parse(await readFile(filePath, 'utf8'))

    assert(raw && typeof raw === 'object', `Arquivo inválido: ${fileName}`)
    assert(raw.meta && typeof raw.meta === 'object', `Meta ausente em ${fileName}`)
    assert(Array.isArray(raw.questoes), `Lista de questões ausente em ${fileName}`)
    assert(
      raw.questoes.length === raw.meta.qtde,
      `Quantidade divergente em ${fileName}: meta=${raw.meta.qtde} real=${raw.questoes.length}`,
    )

    lotes.push({
      arquivo: fileName,
      tema: raw.meta.tema,
      subtema: raw.meta.subtema,
      quantidade: raw.questoes.length,
      referenciaOficial: raw.meta.referenciaOficial || null,
      linkFonte: raw.meta.linkFonte || null,
    })

    raw.questoes.forEach(questao => {
      validateQuestao(questao, fileName)

      assert(
        !origemQuestaoIds.has(questao.origemQuestaoId),
        `origemQuestaoId duplicado: ${questao.origemQuestaoId} (${fileName})`,
      )
      assert(
        !fingerprints.has(questao.fingerprint),
        `fingerprint duplicado: ${questao.fingerprint} (${fileName})`,
      )

      origemQuestaoIds.add(questao.origemQuestaoId)
      fingerprints.add(questao.fingerprint)
      temas.set(questao.tema, (temas.get(questao.tema) || 0) + 1)
      questoes.push(questao)
    })
  }

  await mkdir(path.dirname(outFile), { recursive: true })

  const payload = {
    meta: {
      titulo: 'Base própria oficial de questões teóricas',
      origem: 'BASE_PROPRIA_OFICIAL',
      geradoEm: new Date().toISOString(),
      totalLotes: lotes.length,
      totalQuestoes: questoes.length,
      temas: Object.fromEntries([...temas.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))),
      lotes,
    },
    questoes,
  }

  await writeFile(outFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  console.log(
    JSON.stringify(
      {
        arquivo: outFile,
        totalLotes: lotes.length,
        totalQuestoes: questoes.length,
        temas: Object.fromEntries(temas),
      },
      null,
      2,
    ),
  )
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
