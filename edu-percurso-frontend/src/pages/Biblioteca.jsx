import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { assinaturaService, percursoService } from '../services/api'
import ContentThumbnail from '../components/ContentThumbnail'
import { formatDataCurta, formatDuracaoMinutos, formatTipoConteudo } from '../utils/formatters'

export default function Biblioteca() {
  const navigate = useNavigate()
  const [conteudos, setConteudos] = useState([])
  const [assinaturas, setAssinaturas] = useState([])
  const [filtro, setFiltro] = useState('')
  const [loading, setLoading] = useState(true)
  const [secoesAbertas, setSecoesAbertas] = useState({ geral: true })

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

  const { conteudosGerais, secoesLocais } = useMemo(() => {
    const gerais = []
    const agrupados = {}

    filtrados.forEach(item => {
      if (!item.localProvaId) {
        gerais.push(item)
        return
      }

      if (!agrupados[item.localProvaSlug]) {
        agrupados[item.localProvaSlug] = {
          slug: item.localProvaSlug,
          nome: item.localProvaNome,
          itens: [],
        }
      }

      agrupados[item.localProvaSlug].itens.push(item)
    })

    return {
      conteudosGerais: gerais,
      secoesLocais: Object.values(agrupados),
    }
  }, [filtrados])

  const filtroAtivo = filtro.trim().length > 0

  useEffect(() => {
    const chavesAtivas = new Set(['geral', ...secoesLocais.map(secao => `local-${secao.slug}`)])

    setSecoesAbertas(prev => {
      const proximo = {}
      chavesAtivas.forEach(chave => {
        proximo[chave] = chave in prev ? prev[chave] : chave === 'geral'
      })
      return proximo
    })
  }, [secoesLocais])

  function alternarSecao(chave) {
    setSecoesAbertas(prev => ({ ...prev, [chave]: !prev[chave] }))
  }

  function secaoEstaAberta(chave) {
    if (filtroAtivo) return true
    return Boolean(secoesAbertas[chave])
  }

  function renderConteudoCards(itens) {
    return (
      <div className="card-grid">
        {itens.map(item => (
          <div key={item.id} className="percurso-card" onClick={() => navigate(`/conteudos/${item.id}`)}>
            <ContentThumbnail thumbnailUrl={item.thumbnailUrl} titulo={item.titulo} videoUrl={item.videoUrl} />
            <div className="card-body">
              <div className="card-tag">{formatTipoConteudo(item.tipoConteudo)}</div>
              <div className="card-title">{item.titulo}</div>
              <div className="card-desc">{item.resumo || item.descricao}</div>
            </div>
            <div className="card-footer">
              <span className="card-dur">{formatDuracaoMinutos(item.duracaoSegundos)}</span>
              <span className="card-arrow">Abrir modulo</span>
            </div>
          </div>
        ))}
      </div>
    )
  }

  function renderSecao({ chave, titulo, subtitulo, itens, destaque = 'modulos' }) {
    const aberta = secaoEstaAberta(chave)

    return (
      <section key={chave} className="library-section-card">
        <button
          type="button"
          className="library-section-toggle"
          onClick={() => alternarSecao(chave)}
          aria-expanded={aberta}
        >
          <div className="library-section-heading">
            <div className="section-heading">{titulo}</div>
            <div className="section-copy">{subtitulo}</div>
          </div>

          <div className="library-section-meta">
            <span className="badge badge-blue">{itens.length} {destaque}</span>
            <span className="library-section-toggle-label">{aberta ? 'Fechar' : 'Abrir'}</span>
          </div>
        </button>

        {aberta && <div className="library-section-body">{renderConteudoCards(itens)}</div>}
      </section>
    )
  }

  if (loading) return <div className="spinner" />

  return (
    <>
      <div className="student-shell student-shell--compact">
        <section className="student-library-head">
          <div>
            <div className="page-title">Minha biblioteca</div>
            <p className="page-sub" style={{ marginBottom: 0 }}>
              Acesse seus locais e os modulos liberados para revisar com mais criterio.
            </p>
          </div>

          <div className="student-kpi-strip">
            <div className="student-kpi-pill">
              <span className="student-kpi-pill-value">{assinaturasAtivas.length}</span>
              <span className="student-kpi-pill-label">Locais ativos</span>
            </div>
            <div className="student-kpi-pill">
              <span className="student-kpi-pill-value">{conteudosGerais.length}</span>
              <span className="student-kpi-pill-label">Modulos gerais</span>
            </div>
            <div className="student-kpi-pill">
              <span className="student-kpi-pill-value">{filtrados.length}</span>
              <span className="student-kpi-pill-label">Conteudo liberado</span>
            </div>
          </div>
        </section>

        {assinaturasAtivas.length > 0 && (
          <div className="student-chip-grid student-chip-grid--compact">
            {assinaturasAtivas.map(item => (
              <div key={item.id} className="student-chip student-chip--compact">
                <div className="student-chip-title">{item.localProvaNome}</div>
                <div className="student-chip-copy">Ativo ate {formatDataCurta(item.fimEm)}</div>
              </div>
            ))}
          </div>
        )}

        <div className="student-filter-card student-filter-card--inline">
          <div className="student-filter-copy-wrap">
            <div className="student-filter-title">Buscar modulos</div>
            <div className="student-filter-copy">Procure por titulo, tipo de conteudo, categoria ou local de prova.</div>
          </div>
          <input
            className="form-input"
            placeholder="Buscar por titulo, local, tipo ou categoria..."
            value={filtro}
            onChange={event => setFiltro(event.target.value)}
          />
        </div>
      </div>

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
            renderSecao({
              chave: 'geral',
              titulo: 'Modulos gerais',
              subtitulo: 'Baliza, embreagem, erros que mais tiram pontos e o que costuma ser avaliado.',
              itens: conteudosGerais,
            })
          )}

          {secoesLocais.map(secao => (
            renderSecao({
              chave: `local-${secao.slug}`,
              titulo: secao.nome,
              subtitulo: 'Percursos mais frequentes, pontos de atencao e orientacoes praticas desse local.',
              itens: secao.itens,
              destaque: 'conteudos',
            })
          ))}
        </>
      )}
    </>
  )
}
