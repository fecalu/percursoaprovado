import { readFile } from 'node:fs/promises'
import path from 'node:path'

function getArg(flag) {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : null
}

const inputPath = path.resolve(getArg('--input') || path.resolve('tools', 'simulado', 'output', 'aprovadetran-questoes.json'))
const baseUrl = (getArg('--base-url') || 'http://localhost:8080').replace(/\/$/, '')
const email = getArg('--email')
const senha = getArg('--senha')
const dryRun = process.argv.includes('--dry-run')
const atualizarExistentes = process.argv.includes('--atualizar')

async function main() {
  if (!email || !senha) {
    throw new Error('Informe --email e --senha para autenticar como admin.')
  }

  const raw = JSON.parse(await readFile(inputPath, 'utf8'))
  const questoes = raw.questoes || raw

  if (!Array.isArray(questoes) || questoes.length === 0) {
    throw new Error('Nenhuma questao encontrada no arquivo de entrada.')
  }

  const loginResponse = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  })

  if (!loginResponse.ok) {
    throw new Error(`Falha no login: ${loginResponse.status}`)
  }

  const loginData = await loginResponse.json()
  const token = loginData.token

  if (!token) {
    throw new Error('Token de autenticacao nao encontrado na resposta de login.')
  }

  const importResponse = await fetch(`${baseUrl}/admin/questoes/importar-lote`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      dryRun,
      atualizarExistentes,
      questoes,
    }),
  })

  if (!importResponse.ok) {
    const body = await importResponse.text()
    throw new Error(`Falha na importacao: ${importResponse.status} ${body}`)
  }

  const result = await importResponse.json()
  console.log(JSON.stringify(result, null, 2))
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
