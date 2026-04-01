import { useEffect, useState } from 'react'
import { usuarioAdminService } from '../services/api'
import { useToast } from '../hooks/useToast'
import { formatDataHoraCurta } from '../utils/formatters'

function getStatusConfig(usuario) {
  if (usuario.possuiAssinaturas) {
    return {
      badgeClass: 'badge-green',
      badgeLabel: 'Com assinatura',
      descricao: 'Já passou pela liberação de acesso.',
    }
  }

  if (usuario.possuiPedidos) {
    return {
      badgeClass: 'badge-warn',
      badgeLabel: 'Com pedido',
      descricao: 'Já iniciou compra, mas ainda sem assinatura.',
    }
  }

  return {
    badgeClass: 'badge-gray',
    badgeLabel: 'Só cadastro',
    descricao: 'Criou conta, mas ainda não comprou.',
  }
}

function getProviderLabel(provider) {
  if (provider === 'GOOGLE') return 'Google'
  return 'E-mail e senha'
}

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [resumo, setResumo] = useState({
    totalAlunos: 0,
    somenteCadastro: 0,
    comPedido: 0,
    comAssinatura: 0,
  })
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [excluindoEmail, setExcluindoEmail] = useState('')
  const { show, ToastEl } = useToast()

  async function carregarUsuarios(buscaAtual = busca) {
    setLoading(true)
    try {
      const response = await usuarioAdminService.listar({ busca: buscaAtual })
      setUsuarios(response.usuarios || [])
      setResumo(response.resumo || {
        totalAlunos: 0,
        somenteCadastro: 0,
        comPedido: 0,
        comAssinatura: 0,
      })
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao carregar usuários.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      carregarUsuarios(busca)
    }, 220)

    return () => window.clearTimeout(timeoutId)
  }, [busca])

  async function copiarEmail(email) {
    try {
      await navigator.clipboard.writeText(email)
      show('E-mail copiado.')
    } catch {
      show('Não foi possível copiar o e-mail agora.', 'error')
    }
  }

  async function excluirAlunoTeste(email) {
    if (!confirm(`Excluir completamente o aluno ${email} e todo o histórico ligado a ele? Essa ação é irreversível.`)) {
      return
    }

    setExcluindoEmail(email)
    try {
      const response = await usuarioAdminService.excluirAlunoTeste({ email })
      show(
        `${response.mensagem} Pedidos: ${response.pedidosExcluidos}, assinaturas: ${response.assinaturasExcluidas}, progresso: ${response.progressoExcluido}.`
      )
      await carregarUsuarios(busca)
    } catch (error) {
      show(error.response?.data?.erro || 'Erro ao excluir aluno de teste.', 'error')
    } finally {
      setExcluindoEmail('')
    }
  }

  return (
    <>
      {ToastEl}
      <div className="page-title">Usuários</div>
      <p className="page-sub">
        Consulte alunos cadastrados mesmo sem pedido ou assinatura. Essa tela ajuda a localizar cadastros de teste e
        repetir o fluxo sem precisar criar novos e-mails toda hora.
      </p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Alunos cadastrados</div>
          <div className="stat-value">{resumo.totalAlunos}</div>
          <div className="stat-sub">Contas de aluno no banco</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Só cadastro</div>
          <div className="stat-value">{resumo.somenteCadastro}</div>
          <div className="stat-sub">Ainda sem pedido ou assinatura</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Com pedido</div>
          <div className="stat-value">{resumo.comPedido}</div>
          <div className="stat-sub">Já iniciaram checkout</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Com assinatura</div>
          <div className="stat-value">{resumo.comAssinatura}</div>
          <div className="stat-sub">Já possuem acesso liberado</div>
        </div>
      </div>

      <div className="card">
        <div className="section-title-row">
          <div>
            <div className="section-heading">Base de alunos</div>
            <p className="section-copy">Busque por nome ou e-mail para localizar rapidamente um cadastro.</p>
          </div>
        </div>

        <div className="form-group" style={{ marginTop: '1rem', maxWidth: 420 }}>
          <label className="form-label">Buscar aluno</label>
          <input
            className="form-input"
            placeholder="Nome ou e-mail"
            value={busca}
            onChange={event => setBusca(event.target.value)}
          />
        </div>

        {loading ? (
          <div className="spinner" />
        ) : usuarios.length === 0 ? (
          <div className="empty-state" style={{ marginTop: '1rem' }}>
            Nenhum aluno encontrado com esse filtro.
          </div>
        ) : (
          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            <div className="table-head" style={{ gridTemplateColumns: 'minmax(240px, 2fr) 160px 180px 160px 220px' }}>
              <div>Aluno</div>
              <div>Cadastro</div>
              <div>Situação</div>
              <div>Acesso</div>
              <div>Ações</div>
            </div>

            {usuarios.map(usuario => {
              const status = getStatusConfig(usuario)
              return (
                <div
                  key={usuario.id}
                  className="table-row"
                  style={{ gridTemplateColumns: 'minmax(240px, 2fr) 160px 180px 160px 220px' }}
                >
                  <div>
                    <div className="table-name">{usuario.nome || 'Aluno sem nome'}</div>
                    <div className="mini-copy">{usuario.email}</div>
                  </div>

                  <div>
                    <div className="table-name">{formatDataHoraCurta(usuario.criadoEm)}</div>
                    <div className="mini-copy">{getProviderLabel(usuario.authProvider)}</div>
                  </div>

                  <div>
                    <span className={`badge ${status.badgeClass}`}>{status.badgeLabel}</span>
                    <div className="mini-copy" style={{ marginTop: 6 }}>{status.descricao}</div>
                  </div>

                  <div>
                    <div className="table-name">{usuario.possuiAssinaturas ? 'Liberado' : 'Sem acesso'}</div>
                    <div className="mini-copy">{usuario.emailVerificado ? 'E-mail verificado' : 'E-mail pendente'}</div>
                  </div>

                  <div className="table-actions">
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: '6px 10px' }}
                      type="button"
                      onClick={() => copiarEmail(usuario.email)}
                    >
                      Copiar e-mail
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ fontSize: 12, padding: '6px 10px' }}
                      type="button"
                      disabled={excluindoEmail === usuario.email}
                      onClick={() => excluirAlunoTeste(usuario.email)}
                    >
                      {excluindoEmail === usuario.email ? 'Excluindo...' : 'Excluir teste'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
