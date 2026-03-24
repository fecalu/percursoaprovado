import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const MATRIZ_PATH = path.resolve('tools', 'simulado', 'matriz-editorial-300-questoes.csv')
const OUTPUT_DIR = path.resolve('tools', 'simulado', 'lotes')

function getArg(flag) {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : null
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseCsvLine(line) {
  return line.split(';')
}

function buildTemplateQuestion(lote, index) {
  const numero = String(index + 1).padStart(3, '0')
  const slugTema = slugify(lote.tema)
  const slugSubtema = slugify(lote.subtema)

  return {
    enunciado: `Preencher enunciado da questao ${numero} do lote ${lote.tema} / ${lote.subtema}.`,
    imagemUrl: null,
    tema: lote.tema,
    dificuldade: index < lote.facil ? 'FACIL' : index < lote.facil + lote.media ? 'MEDIA' : 'DIFICIL',
    status: 'RASCUNHO',
    explicacaoCurta: 'Preencher explicacao curta com a justificativa do gabarito.',
    explicacaoDetalhada: `Referencia oficial base: ${lote.referenciaOficial}. Fonte exata: preencher trecho e pagina usados na questao.`,
    videoUrl: null,
    ordemExibicao: index,
    origem: 'BASE_PROPRIA_OFICIAL',
    origemQuestaoId: `${slugTema}-${slugSubtema}-${numero}`,
    fingerprint: null,
    alternativas: [
      { texto: 'Alternativa A', imagemUrl: null, ordem: 0, correta: false },
      { texto: 'Alternativa B', imagemUrl: null, ordem: 1, correta: false },
      { texto: 'Alternativa C', imagemUrl: null, ordem: 2, correta: false },
      { texto: 'Alternativa D', imagemUrl: null, ordem: 3, correta: true },
    ],
  }
}

async function loadMatriz() {
  const csv = await readFile(MATRIZ_PATH, 'utf8')
  const [header, ...lines] = csv.trim().split(/\r?\n/)
  const headers = parseCsvLine(header)

  return lines.map(line => {
    const cols = parseCsvLine(line)
    const row = Object.fromEntries(headers.map((key, index) => [key, cols[index] ?? '']))
    return {
      tema: row.tema,
      subtema: row.subtema,
      qtde: Number(row.qtde || 0),
      facil: Number(row.facil || 0),
      media: Number(row.media || 0),
      dificil: Number(row.dificil || 0),
      referenciaOficial: row.referencia_oficial,
      linkFonte: row.link_fonte,
      observacaoEditorial: row.observacao_editorial,
    }
  })
}

async function main() {
  const tema = getArg('--tema')
  const subtema = getArg('--subtema')

  if (!tema || !subtema) {
    throw new Error('Use --tema e --subtema para gerar o template do lote.')
  }

  const matriz = await loadMatriz()
  const lote = matriz.find(item => item.tema === tema && item.subtema === subtema)

  if (!lote) {
    throw new Error('Lote nao encontrado na matriz editorial.')
  }

  const output = {
    meta: {
      tema: lote.tema,
      subtema: lote.subtema,
      qtde: lote.qtde,
      referenciaOficial: lote.referenciaOficial,
      linkFonte: lote.linkFonte,
      observacaoEditorial: lote.observacaoEditorial,
    },
    questoes: Array.from({ length: lote.qtde }, (_, index) => buildTemplateQuestion(lote, index)),
  }

  await mkdir(OUTPUT_DIR, { recursive: true })

  const fileName = `${slugify(lote.tema)}-${slugify(lote.subtema)}-template.json`
  const outputPath = path.join(OUTPUT_DIR, fileName)
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')

  console.log(outputPath)
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
