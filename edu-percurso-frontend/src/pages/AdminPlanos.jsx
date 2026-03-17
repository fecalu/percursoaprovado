import { useEffect, useMemo, useState } from 'react'
import { localProvaService, planoService } from '../services/api'
import { useToast } from '../hooks/useToast'
import { formatPlanoDuracao } from '../utils/formatters'

const VAZIO = {
  localProvaId: '',
  nome: '',
  duracaoDias: 30,
  precoReais: '99,00',
  ativo: true,
}

function fmtMoeda(centavos) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((centavos || 0) / 100)
}

function centavosParaReais(centavos) {
  return ((centavos || 0) / 100).toFixed(2).replace('.', ',')
}

function reaisParaCentavos(valor) {
  const texto = String(valor || '').trim()
  if (!texto) return NaN

  let normalizado = texto.replace(/[^\d,.-]/g, '')
  if (normalizado.includes(',')) {
    normalizado = normalizado.replace(/\./g, '').replace(',', '.')
  } else {
    const partes = normalizado.split('.')
    if (partes.length > 2) {
      normalizado = `${partes.slice(0, -1).join('')}.${partes.at(-1)}`
    }
  }

  const numero = Number(normalizado)
  if (!Number.isFinite(numero)) return NaN
  return Math.round(numero * 100)
}

export default function AdminPlanos() {
  const [locais, setLocais] = useState([])
  const [planos, setPlanos] = useState([])
  const [form, setForm] = useState(VAZIO)
  const [edicaoId, setEdicaoId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const { show, ToastEl } = useToast()

  useEffect(() => {
    Promise.all([
      localProvaService.listar({ todos: true }),
      planoService.listar({ todos: true }),
    ])
      .then(([locaisResp, planosResp]) => {
        setLocais(locaisResp)
        setPlanos(planosResp)
        if (!form.localProvaId && locaisResp[0]) {
          setForm(current => ({ ...current, localProvaId: locaisResp[0].id }))
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const locaisMap = useMemo(() => new Map(locais.map(local => [local.id, local])), [locais])

  async function recarregarPlanos() {
    setPlanos(await planoService.listar({ todos: true }))
  }

  function editar(plano) {
    setEdicaoId(plano.id)
    setForm({
      localProvaId: plano.localProvaId,
      nome: plano.nome,
      duracaoDias: plano.duracaoDias,
      precoReais: centavosParaReais(plano.precoCentavos),
      ativo: plano.ativo,
    })
  }

  function resetar() {
    setEdicaoId(null)
    setForm({
      ...VAZIO,
      localProvaId: locais[0]?.id || '',
    })
  }

  async function salvar(event) {
    event.preventDefault()
    setSalvando(true)

    try {
      const precoCentavos = reaisParaCentavos(form.precoReais)
      if (!Number.isFinite(precoCentavos) || precoCentavos < 0) {
        throw new Error('Informe um preco valido em reais.')
      }

      const payload = {
        ...form,
        duracaoDias: Number(form.duracaoDias),
        precoCentavos,
      }
      delete payload.precoReais

      if (edicaoId) {
        await planoService.atualizar(edicaoId, payload)
        show('Plano atualizado com sucesso.')
      } else {
        await planoService.criar(payload)
        show('Plano criado com sucesso.')
      }

      resetar()
      await recarregarPlanos()
    } catch (error) {
      show(error.response?.data?.erro || error.message || 'Erro ao salvar plano.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(plano) {
    if (!confirm(`Excluir o plano "${plano.nome}"?`)) return

    try {
      await planoService.excluir(plano.id)
      show('Plano excluido com sucesso.')
      if (edicaoId === plano.id) resetar()
      await recarregarPlanos()
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao excluir plano.', 'error')
    }
  }

  return (
    <>
      {ToastEl}
      <div className="page-title">Planos</div>
      <p className="page-sub">Gerencie a duracao e o preco de cada local de prova.</p>

      <div className="admin-grid">
        <div className="card">
          <div className="section-heading">{edicaoId ? 'Editar plano' : 'Novo plano'}</div>
          <form onSubmit={salvar} style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Local de prova</label>
              <select className="form-select" value={form.localProvaId} onChange={event => setForm(current => ({ ...current, localProvaId: event.target.value }))}>
                {locais.map(local => (
                  <option key={local.id} value={local.id}>{local.nome}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Nome</label>
              <input className="form-input" value={form.nome} onChange={event => setForm(current => ({ ...current, nome: event.target.value }))} required />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Duracao em dias</label>
                <input className="form-input" type="number" min="1" value={form.duracaoDias} onChange={event => setForm(current => ({ ...current, duracaoDias: event.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Preco em reais</label>
                <input
                  className="form-input"
                  inputMode="decimal"
                  placeholder="Ex.: 99,90"
                  value={form.precoReais}
                  onChange={event => setForm(current => ({ ...current, precoReais: event.target.value }))}
                  required
                />
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: '1rem' }}>
              <input type="checkbox" checked={form.ativo} onChange={event => setForm(current => ({ ...current, ativo: event.target.checked }))} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
              <span className="form-label" style={{ margin: 0 }}>Plano ativo</span>
            </label>

            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={salvando}>{salvando ? 'Salvando...' : edicaoId ? 'Salvar alteracoes' : 'Criar plano'}</button>
              {edicaoId && <button className="btn btn-ghost" type="button" onClick={resetar}>Cancelar</button>}
            </div>
          </form>
        </div>

        <div className="card">
          <div className="section-heading">Planos cadastrados</div>
          {loading ? (
            <div className="spinner" />
          ) : (
            <div className="stack-list">
              {planos.map(plano => (
                <div key={plano.id} className="stack-row">
                  <div>
                    <div className="table-name">{plano.nome}</div>
                    <div className="mini-copy">
                      {(locaisMap.get(plano.localProvaId)?.nome || plano.localProvaNome)} - {formatPlanoDuracao(plano.duracaoDias)} - {fmtMoeda(plano.precoCentavos)}
                    </div>
                  </div>
                  <div className="table-actions">
                    <span className={`badge ${plano.ativo ? 'badge-green' : 'badge-gray'}`}>{plano.ativo ? 'Ativo' : 'Inativo'}</span>
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => editar(plano)}>Editar</button>
                    <button className="btn btn-danger" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => excluir(plano)}>Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
