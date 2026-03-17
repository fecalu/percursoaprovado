import { useEffect, useState } from 'react'
import { localProvaService } from '../services/api'
import { useToast } from '../hooks/useToast'

const VAZIO = {
  nome: '',
  slug: '',
  descricao: '',
  cidade: 'Sao Luis',
  ordemExibicao: 0,
  ativo: true,
}

export default function AdminLocais() {
  const [locais, setLocais] = useState([])
  const [form, setForm] = useState(VAZIO)
  const [edicaoId, setEdicaoId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const { show, ToastEl } = useToast()

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    try {
      setLocais(await localProvaService.listar({ todos: true }))
    } finally {
      setLoading(false)
    }
  }

  function editar(local) {
    setEdicaoId(local.id)
    setForm({
      nome: local.nome || '',
      slug: local.slug || '',
      descricao: local.descricao || '',
      cidade: local.cidade || 'Sao Luis',
      ordemExibicao: local.ordemExibicao ?? 0,
      ativo: local.ativo ?? true,
    })
  }

  function resetar() {
    setEdicaoId(null)
    setForm(VAZIO)
  }

  async function salvar(event) {
    event.preventDefault()
    setSalvando(true)
    try {
      const payload = {
        ...form,
        ordemExibicao: Number(form.ordemExibicao) || 0,
      }
      if (edicaoId) {
        await localProvaService.atualizar(edicaoId, payload)
        show('Local atualizado com sucesso.')
      } else {
        await localProvaService.criar(payload)
        show('Local criado com sucesso.')
      }
      resetar()
      await carregar()
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao salvar local.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(local) {
    if (!confirm(`Excluir o local "${local.nome}"?`)) return
    try {
      await localProvaService.excluir(local.id)
      show('Local excluido com sucesso.')
      if (edicaoId === local.id) resetar()
      await carregar()
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao excluir local.', 'error')
    }
  }

  return (
    <>
      {ToastEl}
      <div className="page-title">Locais de prova</div>
      <p className="page-sub">Cadastre os locais oficiais, cidade, slug e ordem de exibicao.</p>

      <div className="admin-grid">
        <div className="card">
          <div className="section-heading">{edicaoId ? 'Editar local' : 'Novo local'}</div>
          <form onSubmit={salvar} style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Nome</label>
              <input className="form-input" value={form.nome} onChange={e => setForm(current => ({ ...current, nome: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Slug</label>
              <input className="form-input" value={form.slug} onChange={e => setForm(current => ({ ...current, slug: e.target.value }))} placeholder="Opcional, pode deixar em branco" />
            </div>
            <div className="form-group">
              <label className="form-label">Descricao</label>
              <textarea className="form-textarea" value={form.descricao} onChange={e => setForm(current => ({ ...current, descricao: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Cidade</label>
                <input className="form-input" value={form.cidade} onChange={e => setForm(current => ({ ...current, cidade: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Ordem</label>
                <input className="form-input" type="number" value={form.ordemExibicao} onChange={e => setForm(current => ({ ...current, ordemExibicao: e.target.value }))} />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: '1rem' }}>
              <input type="checkbox" checked={form.ativo} onChange={e => setForm(current => ({ ...current, ativo: e.target.checked }))} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
              <span className="form-label" style={{ margin: 0 }}>Local ativo</span>
            </label>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={salvando}>{salvando ? 'Salvando...' : edicaoId ? 'Salvar alteracoes' : 'Criar local'}</button>
              {edicaoId && <button className="btn btn-ghost" type="button" onClick={resetar}>Cancelar</button>}
            </div>
          </form>
        </div>

        <div className="card">
          <div className="section-heading">Locais cadastrados</div>
          {loading ? (
            <div className="spinner" />
          ) : (
            <div className="stack-list">
              {locais.map(local => (
                <div key={local.id} className="stack-row">
                  <div>
                    <div className="table-name">{local.nome}</div>
                    <div className="mini-copy">{local.cidade} - /{local.slug}</div>
                  </div>
                  <div className="table-actions">
                    <span className={`badge ${local.ativo ? 'badge-green' : 'badge-gray'}`}>{local.ativo ? 'Ativo' : 'Inativo'}</span>
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => editar(local)}>Editar</button>
                    <button className="btn btn-danger" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => excluir(local)}>Excluir</button>
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
