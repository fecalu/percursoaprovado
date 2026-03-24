import { createHash } from 'node:crypto'
import vm from 'node:vm'

export const SOURCE_NAME = 'APROVADETRAN'
export const DEFAULT_PAGE_URL = 'https://www.aprovadetran.com.br/simulado-detran/gratuito'

function normalizeText(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
}

function stripHtml(value) {
  return (value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function mapTema(slug) {
  const normalized = normalizeText(slug)
  const map = {
    'sinalizacao de transito': 'PLACAS',
    'direcao defensiva': 'DIRECAO_DEFENSIVA',
    'primeiros socorros': 'PRIMEIROS_SOCORROS',
    'mecanica basica': 'MECANICA_BASICA',
    'cidadania e meio ambiente': 'MEIO_AMBIENTE_CIDADANIA',
    'circulacao e conduta': 'LEGISLACAO',
    'processo de habilitacao': 'LEGISLACAO',
    'infracoes e penalidades': 'LEGISLACAO',
  }

  return map[normalized] || 'LEGISLACAO'
}

function mapDificuldade(tags = []) {
  const slugs = tags
    .map(tag => normalizeText(tag.slug || tag.name))
    .filter(Boolean)

  if (slugs.includes('facil')) return 'FACIL'
  if (slugs.includes('intermediario')) return 'MEDIA'
  if (slugs.includes('dificil')) return 'DIFICIL'
  return 'MEDIA'
}

function toAbsoluteUrl(url) {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return new URL(url, 'https://www.aprovadetran.com.br').toString()
}

function extractChunkPath(html, pageUrl) {
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]*\/_next\/static\/chunks\/pages\/[^"]+\.js)"/g)]
    .map(match => match[1])

  const preferred = scripts.find(item => item.includes('/simulado-detran/'))
    || scripts.find(item => item.includes('/simulado-detran-'))
    || scripts[0]

  if (!preferred) {
    throw new Error(`Nao foi possivel localizar chunk JS para ${pageUrl}`)
  }

  return preferred
}

function extractArrayExpression(bundle) {
  const marker = 'let v='
  const start = bundle.indexOf(marker)
  if (start < 0) {
    throw new Error('Nao foi possivel localizar o array de questoes no bundle.')
  }

  const arrayStart = start + marker.length
  let depth = 0
  let inString = false
  let stringChar = ''
  let escaped = false
  let firstBracketSeen = false

  for (let i = arrayStart; i < bundle.length; i += 1) {
    const char = bundle[i]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === stringChar) {
        inString = false
        stringChar = ''
      }
      continue
    }

    if (char === '"' || char === "'") {
      inString = true
      stringChar = char
      continue
    }

    if (char === '[') {
      depth += 1
      firstBracketSeen = true
      continue
    }

    if (char === ']') {
      depth -= 1
      if (firstBracketSeen && depth === 0) {
        return bundle.slice(arrayStart, i + 1)
      }
    }
  }

  throw new Error('Nao foi possivel determinar o fim do array de questoes.')
}

function evaluateQuestions(expression) {
  return vm.runInNewContext(expression, {}, { timeout: 5000 })
}

function buildFingerprint(question, alternatives) {
  const base = [
    normalizeText(question),
    ...alternatives.map(item => normalizeText(item.texto || '')),
  ].join('||')

  return sha256(base)
}

function normalizeQuestion(item, pageUrl) {
  const explicacaoDetalhada = stripHtml(item.tip)
  const alternativas = item.options.map((option, index) => ({
    ordem: index,
    texto: option.text?.trim() || null,
    imagemUrl: null,
    correta: Boolean(option.correct),
  }))

  return {
    origem: SOURCE_NAME,
    origemQuestaoId: String(item.id),
    fingerprint: buildFingerprint(item.question, alternativas),
    enunciado: item.question.trim(),
    imagemUrl: toAbsoluteUrl(item.image?.url || null),
    tema: mapTema(item.matter?.name || item.matter?.slug || ''),
    dificuldade: mapDificuldade(item.tags),
    status: 'RASCUNHO',
    explicacaoCurta: explicacaoDetalhada || 'Questao importada automaticamente. Revise a explicacao antes de publicar.',
    explicacaoDetalhada: explicacaoDetalhada || null,
    videoUrl: null,
    ordemExibicao: 0,
    alternativas,
    sourcePageUrl: pageUrl,
  }
}

export async function extractQuestionsFromPage(pageUrl) {
  const pageResponse = await fetch(pageUrl, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    },
  })

  if (!pageResponse.ok) {
    throw new Error(`Falha ao baixar a pagina alvo: ${pageResponse.status}`)
  }

  const html = await pageResponse.text()
  const chunkPath = extractChunkPath(html, pageUrl)
  const chunkUrl = new URL(chunkPath, pageUrl).toString()
  const bundleResponse = await fetch(chunkUrl)

  if (!bundleResponse.ok) {
    throw new Error(`Falha ao baixar o chunk JS: ${bundleResponse.status}`)
  }

  const bundle = await bundleResponse.text()
  const arrayExpression = extractArrayExpression(bundle)
  const sourceQuestions = evaluateQuestions(arrayExpression)
  const normalized = sourceQuestions.map(item => normalizeQuestion(item, pageUrl))

  return {
    source: SOURCE_NAME,
    pageUrl,
    extractedAt: new Date().toISOString(),
    total: normalized.length,
    questoes: normalized,
  }
}
