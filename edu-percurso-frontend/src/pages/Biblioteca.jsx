import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { assinaturaService, percursoService, progressoService } from '../services/api'
import ContentThumbnail from '../components/ContentThumbnail'
import { formatDataCurta, formatDuracaoMinutos, formatTipoConteudo } from '../utils/formatters'

export default function Biblioteca() {
  const navigate = useNavigate()
  const [conteudos, setConteudos] = useState([])
  const [assinaturas, setAssinaturas] = useState([])
  const [progresso, setProgresso] = useState([])
  const [filtro, setFiltro] = useState('')
  const [loading, setLoading] = useState(true)
  const [secoesAbertas, setSecoesAbertas] = useState({})

  useEffect(() => {
    Promise.all([percursoService.listar(), assinaturaService.minhas(), progressoService.meu()])
      .then(([conteudosResp, assinaturasResp, progressoResp]) => {
        setConteudos(conteudosResp)
        setAssinaturas(assinaturasResp)
        setProgresso(progressoResp)
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

  const progressoMap = useMemo(() => {
    const map = new Map()
    progresso.forEach(item => {
      map.set(item.percursoId, item)
    })
    return map
  }, [progresso])

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
        proximo[chave] = chave in prev ? prev[chave] : false
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

  function resolverStatusAula(item) {
    const progressoItem = progressoMap.get(item.id)
    if (!progressoItem) {
      return {
        label: 'Nao iniciado',
        toneClass: 'is-neutral',
        concluido: false,
        progressoPercentual: 0,
      }
    }

    if (progressoItem.concluido) {
      return {
        label: 'Concluido',
        toneClass: 'is-complete',
        concluido: true,
        progressoPercentual: 100,
      }
    }

    const duracaoTotal = progressoItem.duracaoTotal || item.duracaoSegundos || 0
    const progressoPercentual = duracaoTotal > 0
      ? Math.min(100, Math.round(((progressoItem.segundosAssistidos || 0) / duracaoTotal) * 100))
      : 0

    return {
      label: progressoPercentual > 0 ? 'Em andamento' : 'Nao iniciado',
      toneClass: progressoPercentual > 0 ? 'is-active' : 'is-neutral',
      concluido: false,
      progressoPercentual,
    }
  }

  function renderAulas(itens) {
    return (
      <div className="library-lesson-list">
        {itens.map(item => {
          const status = resolverStatusAula(item)

          return (
            <button
              key={item.id}
              type="button"
              className={`library-lesson-row${status.concluido ? ' is-concluded' : ''}`}
              onClick={() => navigate(`/conteudos/${item.id}`)}
            >
              <div className="library-lesson-thumb">
                <ContentThumbnail thumbnailUrl={item.thumbnailUrl} titulo={item.titulo} videoUrl={item.videoUrl} />
                <span className="library-lesson-duration">{formatDuracaoMinutos(item.duracaoSegundos)}</span>
                {status.concluido && <span className="library-lesson-check">{'\u2713'}</span>}
              </div>

              <div className="library-lesson-body">
                <div className="library-lesson-topline">
                  <span className="card-tag">{formatTipoConteudo(item.tipoConteudo)}</span>
                  <span className={`library-lesson-status ${status.toneClass}`}>
                    <span className="library-lesson-status-dot" />
                    {status.label}
                  </span>
                </div>
                <div className="library-lesson-title">{item.titulo}</div>
                <div className="library-lesson-copy">{item.resumo || item.descricao || 'Conteudo sem resumo cadastrado.'}</div>
                <div className="library-lesson-meta">
                  <span>{formatDuracaoMinutos(item.duracaoSegundos)}</span>
                  {status.progressoPercentual > 0 && !status.concluido && (
                    <span>{status.progressoPercentual}% assistido</span>
                  )}
                </div>
              </div>

              <div className="library-lesson-action">{status.concluido ? 'Rever' : status.progressoPercentual > 0 ? 'Continuar' : 'Comecar'}</div>
            </button>
          )
        })}
      </div>
    )
  }

  function renderSecao({ chave, titulo, subtitulo, itens, destaque = 'modulos' }) {
    const aberta = secaoEstaAberta(chave)
    const concluidos = itens.filter(item => resolverStatusAula(item).concluido).length
    const duracaoTotal = itens.reduce((acc, item) => acc + (item.duracaoSegundos || 0), 0)
    const progressoPercentual = itens.length > 0 ? Math.round((concluidos / itens.length) * 100) : 0

    return (
      <section key={chave} className="library-module-card">
        <button
          type="button"
          className="library-module-toggle"
          onClick={() => alternarSecao(chave)}
          aria-expanded={aberta}
        >
          <div className="library-module-hero">
            <div className="library-module-heading">
              <div className="section-heading">{titulo}</div>
              <div className="section-copy">{subtitulo}</div>
              <div className="library-module-caption">
                <span>{itens.length} {destaque}</span>
                <span>{formatDuracaoMinutos(duracaoTotal)}</span>
                <span>{concluidos} concluidas</span>
              </div>
            </div>
          </div>

          <div className="library-module-meta">
            <span className="library-module-progress-copy">{concluidos} de {itens.length} aulas concluidas</span>
            <span className="library-module-toggle-label">{aberta ? 'Fechar aulas' : 'Abrir aulas'}</span>
          </div>
        </button>

        <div className="library-module-progress">
          <div className="student-progress-bar">
            <div className="student-progress-fill" style={{ width: `${progressoPercentual}%` }} />
          </div>
          <div className="mini-copy">{concluidos} de {itens.length} aulas concluidas</div>
        </div>

        {aberta && <div className="library-module-body">{renderAulas(itens)}</div>}
      </section>
    )
  }

  if (loading) return <div className="spinner" />

  return (
    <div className="student-library-page">
      <div className="student-shell student-shell--compact">
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
          <input
            className="form-input student-filter-input--slim"
            placeholder="Buscar por modulo, aula, local ou tipo..."
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
    </div>
  )
}
