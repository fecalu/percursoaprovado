import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RevealSection from '../components/RevealSection'
import { assinaturaService, percursoService } from '../services/api'
import ContentThumbnail from '../components/ContentThumbnail'
import { formatDataCurta, formatDuracaoMinutos, formatTipoConteudo } from '../utils/formatters'

export default function Biblioteca() {
  const navigate = useNavigate()
  const [conteudos, setConteudos] = useState([])
  const [assinaturas, setAssinaturas] = useState([])
  const [filtro, setFiltro] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([percursoService.listar(), assinaturaService.minhas()])
      .then(([conteudosResp, assinaturasResp]) => {
        setConteudos(conteudosResp)
        setAssinaturas(assinaturasResp)
      })
      .finally(() => setLoading(false))
  }, [])

  const assinaturasAtivas = useMemo(
    () => assinaturas.filter(item => item.status === 'ATIVA' && item.paymentStatus === 'PAGO'),
    [assinaturas]
  )

  const filtrados = useMemo(() => {
    const termo = filtro.trim().toLowerCase()

    if (!termo) return conteudos

    return conteudos.filter(item =>
      item.titulo.toLowerCase().includes(termo) ||
      (item.descricao || '').toLowerCase().includes(termo) ||
      (item.resumo || '').toLowerCase().includes(termo) ||
      (item.categoriaNome || '').toLowerCase().includes(termo) ||
      (item.localProvaNome || '').toLowerCase().includes(termo) ||
      (item.tipoConteudo || '').toLowerCase().includes(termo)
    )
  }, [conteudos, filtro])

  const conteudosGerais = filtrados.filter(item => !item.localProvaId)
  const conteudosPorLocal = filtrados
    .filter(item => item.localProvaId)
    .reduce((acc, item) => {
      if (!acc[item.localProvaSlug]) {
        acc[item.localProvaSlug] = {
          slug: item.localProvaSlug,
          nome: item.localProvaNome,
          itens: [],
        }
      }

      acc[item.localProvaSlug].itens.push(item)
      return acc
    }, {})

  if (loading) return <div className="spinner" />

  return (
    <>
      <RevealSection className="student-shell" delay={30}>
        <section className="student-hero">
          <div>
            <div className="page-title">Minha biblioteca</div>
            <p className="page-sub" style={{ marginBottom: 0 }}>
              Revise seus locais ativos e os modulos que ajudam voce a dirigir com mais confianca no dia da prova.
            </p>
          </div>
          <div className="student-kpi-grid">
            <div className="student-kpi-card">
              <div className="student-kpi-label">Locais ativos</div>
              <div className="student-kpi-value">{assinaturasAtivas.length}</div>
              <div className="student-kpi-copy">planos em vigor</div>
            </div>
            <div className="student-kpi-card">
              <div className="student-kpi-label">Modulos gerais</div>
              <div className="student-kpi-value">{conteudosGerais.length}</div>
              <div className="student-kpi-copy">disponiveis agora</div>
            </div>
            <div className="student-kpi-card">
              <div className="student-kpi-label">Conteudos liberados</div>
              <div className="student-kpi-value">{filtrados.length}</div>
              <div className="student-kpi-copy">na biblioteca</div>
            </div>
          </div>
        </section>

        {assinaturasAtivas.length > 0 && (
          <div className="student-chip-grid">
            {assinaturasAtivas.map(item => (
              <div key={item.id} className="student-chip">
                <div className="student-chip-title">{item.localProvaNome}</div>
                <div className="student-chip-copy">Ativo ate {formatDataCurta(item.fimEm)}</div>
              </div>
            ))}
          </div>
        )}

        <div className="student-filter-card">
          <div className="student-filter-title">Buscar na biblioteca</div>
          <div className="student-filter-copy">Procure por titulo, tipo de conteudo, categoria ou local de prova.</div>
          <input
            className="form-input"
            placeholder="Buscar por titulo, local, tipo ou categoria..."
            value={filtro}
            onChange={event => setFiltro(event.target.value)}
          />
        </div>
      </RevealSection>

      {assinaturasAtivas.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">+</div>
          Sua biblioteca ainda esta vazia porque voce nao possui um plano ativo.
          <div style={{ marginTop: '1rem' }}>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              Ver locais de prova
            </button>
          </div>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">?</div>
          Nenhum conteudo encontrado com esse filtro.
        </div>
      ) : (
        <>
          {conteudosGerais.length > 0 && (
            <RevealSection as="section" className="content-section" delay={60}>
              <div className="section-title-row">
                <div>
                  <div className="section-heading">Modulos gerais</div>
                  <div className="section-copy">Baliza, embreagem, erros que mais tiram pontos e o que costuma ser avaliado.</div>
                </div>
                <span className="badge badge-blue">{conteudosGerais.length} modulos</span>
              </div>
              <div className="card-grid">
                {conteudosGerais.map(item => (
                  <div key={item.id} className="percurso-card" onClick={() => navigate(`/conteudos/${item.id}`)}>
                    <ContentThumbnail thumbnailUrl={item.thumbnailUrl} titulo={item.titulo} videoUrl={item.videoUrl} />
                    <div className="card-body">
                      <div className="card-tag">{formatTipoConteudo(item.tipoConteudo)}</div>
                      <div className="card-title">{item.titulo}</div>
                      <div className="card-desc">{item.resumo || item.descricao}</div>
                    </div>
                    <div className="card-footer">
                      <span className="card-dur">{formatDuracaoMinutos(item.duracaoSegundos)}</span>
                      <span className="card-arrow">Assistir -&gt;</span>
                    </div>
                  </div>
                ))}
              </div>
            </RevealSection>
          )}

          {Object.values(conteudosPorLocal).map(secao => (
            <RevealSection key={secao.slug} as="section" className="content-section" delay={80}>
              <div className="section-title-row">
                <div>
                  <div className="section-heading">{secao.nome}</div>
                  <div className="section-copy">Percursos mais frequentes, pontos de atencao e orientacoes praticas desse local.</div>
                </div>
                <span className="badge badge-blue">{secao.itens.length} conteudos</span>
              </div>
              <div className="card-grid">
                {secao.itens.map(item => (
                  <div key={item.id} className="percurso-card" onClick={() => navigate(`/conteudos/${item.id}`)}>
                    <ContentThumbnail thumbnailUrl={item.thumbnailUrl} titulo={item.titulo} videoUrl={item.videoUrl} />
                    <div className="card-body">
                      <div className="card-tag">{formatTipoConteudo(item.tipoConteudo)}</div>
                      <div className="card-title">{item.titulo}</div>
                      <div className="card-desc">{item.resumo || item.descricao}</div>
                    </div>
                    <div className="card-footer">
                      <span className="card-dur">{formatDuracaoMinutos(item.duracaoSegundos)}</span>
                      <span className="card-arrow">Assistir -&gt;</span>
                    </div>
                  </div>
                ))}
              </div>
            </RevealSection>
          ))}
        </>
      )}
    </>
  )
}
