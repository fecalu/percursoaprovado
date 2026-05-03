import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getStoredToken, decodeJwtPayload } from '../utils/authSession'

const EMAIL_SUPORTE = 'suporte@percursoaprovado.com.br'

export default function PerfilAluno() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const email = useMemo(() => {
    const token = getStoredToken()
    return decodeJwtPayload(token)?.sub || ''
  }, [])

  const linkSuporte = useMemo(() => {
    const assunto = encodeURIComponent('Ajuda com minha conta - Percurso Aprovado')
    const corpo = encodeURIComponent(`Ola, equipe.\n\nPreciso de ajuda com minha conta.\n\nNome: ${user?.nome || ''}\nE-mail: ${email || ''}\n\n`)
    return `mailto:${EMAIL_SUPORTE}?subject=${assunto}&body=${corpo}`
  }, [email, user?.nome])

  return (
    <div className="student-dashboard-page">
      <div className="student-shell student-shell--compact">
        <section className="student-library-head">
          <div>
            <div className="page-title">Meu perfil</div>
            <p className="page-sub" style={{ marginBottom: 0 }}>
              Gerencie os dados da sua conta, sua seguranca e os canais de ajuda.
            </p>
          </div>
        </section>
      </div>

      <section className="student-grid student-profile-grid">
        <article className="student-card student-profile-card">
          <div className="student-card-top">
            <span className="badge badge-blue">Minha conta</span>
            <span className="student-dashboard-card-meta">Dados principais do seu acesso</span>
          </div>
          <div className="student-card-title">Seus dados</div>
          <div className="student-detail-list student-profile-detail-list">
            <div className="student-detail-item">
              <span className="student-detail-label">Nome</span>
              <span className="student-detail-value">{user?.nome || '-'}</span>
            </div>
            <div className="student-detail-item">
              <span className="student-detail-label">E-mail</span>
              <span className="student-detail-value">{email || '-'}</span>
            </div>
            <div className="student-detail-item">
              <span className="student-detail-label">Tipo de conta</span>
              <span className="student-detail-value">{user?.role === 'ADMIN' ? 'Administrador' : 'Aluno'}</span>
            </div>
          </div>
          <div className="student-inline-note student-profile-note">
            Se voce precisar atualizar nome ou e-mail, fale com o suporte para manter sua conta correta.
          </div>
          <div className="student-card-actions">
            <a className="btn btn-ghost" href={linkSuporte}>
              Falar com suporte
            </a>
          </div>
        </article>

        <article className="student-card student-profile-card">
          <div className="student-card-top">
            <span className="badge badge-green">Seguranca</span>
            <span className="student-dashboard-card-meta">Proteja sua conta quando precisar</span>
          </div>
          <div className="student-card-title">Acesso e senha</div>
          <div className="student-card-copy">
            Se quiser trocar sua senha, voce pode iniciar agora o fluxo de redefinicao e receber as instrucoes no seu e-mail.
          </div>
          <div className="student-detail-list student-profile-detail-list">
            <div className="student-detail-item">
              <span className="student-detail-label">Recuperacao</span>
              <span className="student-detail-value">Envio de link seguro para redefinir sua senha.</span>
            </div>
          </div>
          <div className="student-card-actions">
            <button className="btn btn-primary" onClick={() => navigate('/forgot-password')}>
              Alterar senha
            </button>
          </div>
        </article>

        <article className="student-card student-profile-card">
          <div className="student-card-top">
            <span className="badge badge-warn">Ajuda</span>
            <span className="student-dashboard-card-meta">Atalhos utiles para sua conta</span>
          </div>
          <div className="student-card-title">Suporte e acompanhamento</div>
          <div className="student-card-copy">
            Se surgir qualquer duvida com pagamento, acesso ou uso da plataforma, voce encontra aqui o caminho mais rapido.
          </div>
          <div className="student-card-actions">
            <a className="btn btn-primary" href={linkSuporte}>
              Enviar e-mail
            </a>
            <button className="btn btn-ghost" onClick={() => navigate('/meus-pedidos')}>
              Ver pagamentos
            </button>
          </div>
        </article>
      </section>
    </div>
  )
}
