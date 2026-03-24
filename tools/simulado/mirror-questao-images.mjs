import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

function getArg(flag) {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : null
}

const inputPath = path.resolve(getArg('--input') || path.resolve('tools', 'simulado', 'output', 'aprovadetran-questoes.json'))
const outputPath = path.resolve(getArg('--output') || path.resolve('tools', 'simulado', 'output', 'aprovadetran-questoes-mirrored.json'))
const baseUrl = (getArg('--base-url') || 'http://localhost:8080').replace(/\/$/, '')
const email = getArg('--email')
const senha = getArg('--senha')

function inferFileName(url) {
  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname
    const last = pathname.split('/').pop() || 'imagem'
    return last.includes('.') ? last : `${last}.png`
  } catch {
    return 'imagem.png'
  }
}

async function login() {
  if (!email || !senha) {
    throw new Error('Informe --email e --senha para autenticar como admin.')
  }

  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  })

  if (!response.ok) {
    throw new Error(`Falha no login: ${response.status}`)
  }

  const data = await response.json()
  if (!data.token) {
    throw new Error('Token nao encontrado na resposta de login.')
  }

  return data.token
}

async function uploadImage(token, imageUrl) {
  const imageResponse = await fetch(imageUrl, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    },
  })

  if (!imageResponse.ok) {
    throw new Error(`Falha ao baixar imagem ${imageUrl}: ${imageResponse.status}`)
  }

  const buffer = Buffer.from(await imageResponse.arrayBuffer())
  const contentType = imageResponse.headers.get('content-type') || 'image/png'
  const form = new FormData()
  form.append('file', new Blob([buffer], { type: contentType }), inferFileName(imageUrl))

  const uploadResponse = await fetch(`${baseUrl}/uploads/thumbnails`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
    },
    body: form,
  })

  if (!uploadResponse.ok) {
    const body = await uploadResponse.text()
    throw new Error(`Falha ao enviar imagem ${imageUrl}: ${uploadResponse.status} ${body}`)
  }

  const uploaded = await uploadResponse.json()
  return uploaded.url
}

async function main() {
  const raw = JSON.parse(await readFile(inputPath, 'utf8'))
  const questoes = raw.questoes || raw

  if (!Array.isArray(questoes) || questoes.length === 0) {
    throw new Error('Nenhuma questao encontrada no arquivo informado.')
  }

  const token = await login()
  const cache = new Map()

  for (const questao of questoes) {
    if (questao.imagemUrl) {
      if (!cache.has(questao.imagemUrl)) {
        cache.set(questao.imagemUrl, await uploadImage(token, questao.imagemUrl))
      }
      questao.imagemUrl = cache.get(questao.imagemUrl)
    }

    for (const alternativa of questao.alternativas || []) {
      if (!alternativa.imagemUrl) continue
      if (!cache.has(alternativa.imagemUrl)) {
        cache.set(alternativa.imagemUrl, await uploadImage(token, alternativa.imagemUrl))
      }
      alternativa.imagemUrl = cache.get(alternativa.imagemUrl)
    }
  }

  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify({ ...raw, questoes }, null, 2)}\n`, 'utf8')

  console.log(`Imagens espelhadas: ${cache.size}`)
  console.log(`Arquivo salvo em: ${outputPath}`)
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
