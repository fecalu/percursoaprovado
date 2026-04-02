import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { assinaturaService, percursoService, progressoService } from '../services/api'
import ContentThumbnail from '../components/ContentThumbnail'
import { formatDataCurta, formatDuracaoMinutos, formatTipoConteudo } from '../utils/formatters'

function compararTexto(a = '', b = '') {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
}

function ordenarAulas(a, b) {
  const ordemA = a.ordemExibicao ?? 0
  const ordemB = b.ordemExibicao ?? 0

  if (ordemA !== ordemB) {
    return ordemA - ordemB
  }

  return compararTexto(a.titulo, b.titulo)
}

function ordenarModulos(a, b) {
  const ordemA = a.ordemExibicao ?? Number.MAX_SAFE_INTEGER
  const ordemB = b.ordemExibicao ?? Number.MAX_SAFE_INTEGER

  if (ordemA !== ordemB) {
    return ordemA - ordemB
  }

  return compararTexto(a.titulo, b.titulo)
}

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

  const { modulosGerais, secoesLocais } = useMemo(() => {
    const modulosGeraisMap = new Map()
    const secoesLocaisMap = new Map()

    filtrados.forEach(item => {
      const categoriaChave = item.categoriaId || 'sem-modulo'
      const categoriaTitulo = item.categoriaNome || 'Sem módulo'
      const categoriaOrdemExibicao = item.categoriaOrdemExibicao ?? Number.MAX_SAFE_INTEGER

      if (!item.localProvaId) {
        if (!modulosGeraisMap.has(categoriaChave)) {
          modulosGeraisMap.set(categoriaChave, {
            chave: `geral-${categoriaChave}`,
            titulo: categoriaTitulo,
            ordemExibicao: categoriaOrdemExibicao,
            subtitulo: item.categoriaId
              ? 'Aulas gerais deste módulo, liberadas para qualquer plano ativo.'
              : 'Aulas gerais que ainda precisam ser organizadas em um módulo.',
            itens: [],
          })
        }

        modulosGeraisMap.get(categoriaChave).itens.push(item)
        return
      }

      const localChave = item.localProvaSlug || item.localProvaId
      if (!secoesLocaisMap.has(localChave)) {
        secoesLocaisMap.set(localChave, {
          chave: `local-${localChave}`,
          slug: item.localProvaSlug,
          nome: item.localProvaNome,
          modulosMap: new Map(),
        })
      }

      const secaoLocal = secoesLocaisMap.get(localChave)

      if (!secaoLocal.modulosMap.has(categoriaChave)) {
        secaoLocal.modulosMap.set(categoriaChave, {
          chave: `local-${localChave}-${categoriaChave}`,
          titulo: categoriaTitulo,
          ordemExibicao: categoriaOrdemExibicao,
          subtitulo: item.categoriaId
            ? `Aulas deste módulo para ${item.localProvaNome}.`
            : `Aulas de ${item.localProvaNome} que ainda precisam ser organizadas em um módulo.`,
          itens: [],
        })
      }

      secaoLocal.modulosMap.get(categoriaChave).itens.push(item)
    })

    return {
      modulosGerais: Array.from(modulosGeraisMap.values())
        .map(modulo => ({
          ...modulo,
          itens: [...modulo.itens].sort(ordenarAulas),
        }))
        .sort(ordenarModulos),
      secoesLocais: Array.from(secoesLocaisMap.values())
        .map(secao => ({
          ...secao,
          modulos: Array.from(secao.modulosMap.values())
            .map(modulo => ({
              ...modulo,
              itens: [...modulo.itens].sort(ordenarAulas),
            }))
            .sort(ordenarModulos),
        }))
        .sort((a, b) => compararTexto(a.nome, b.nome)),
    }
  }, [filtrados])

  const filtroAtivo = filtro.trim().length > 0

  useEffect(() => {
    const chavesAtivas = new Set([
      ...modulosGerais.map(modulo => modulo.chave),
      ...secoesLocais.flatMap(secao => secao.modulos.map(modulo => modulo.chave)),
    ])

    setSecoesAbertas(prev => {
      const proximo = {}
      chavesAtivas.forEach(chave => {
        proximo[chave] = chave in prev ? prev[chave] : false
      })
      return proximo
    })
  }, [modulosGerais, secoesLocais])

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
        label: 'Não iniciado',
        toneClass: 'is-neutral',
        concluido: false,
        progressoPercentual: 0,
      }
    }

    if (progressoItem.concluido) {
      return {
        label: 'Concluído',
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
      label: progressoPercentual > 0 ? 'Em andamento' : 'Não iniciado',
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
                <div className="library-lesson-copy">{item.resumo || item.descricao || 'Conteúdo sem resumo cadastrado.'}</div>
                <div className="library-lesson-meta">
                  <span>{formatDuracaoMinutos(item.duracaoSegundos)}</span>
                  {status.progressoPercentual > 0 && !status.concluido && (
                    <span>{status.progressoPercentual}% assistido</span>
                  )}
                </div>
              </div>

              <div className="library-lesson-action">{status.concluido ? 'Rever' : status.progressoPercentual > 0 ? 'Continuar' : 'Começar'}</div>
            </button>
          )
        })}
      </div>
    )
  }

  function renderModulo(modulo) {
    const aberta = secaoEstaAberta(modulo.chave)
    const concluidos = modulo.itens.filter(item => resolverStatusAula(item).concluido).length
    const duracaoTotal = modulo.itens.reduce((acc, item) => acc + (item.duracaoSegundos || 0), 0)
    const progressoPercentual = modulo.itens.length > 0 ? Math.round((concluidos / modulo.itens.length) * 100) : 0

    return (
      <section key={modulo.chave} className="library-module-card">
        <button
          type="button"
          className="library-module-toggle"
          onClick={() => alternarSecao(modulo.chave)}
          aria-expanded={aberta}
        >
          <div className="library-module-hero">
            <div className="library-module-heading">
              <div className="section-heading">{modulo.titulo}</div>
              <div className="section-copy">{modulo.subtitulo}</div>
              <div className="library-module-caption">
                <span>{modulo.itens.length} aulas</span>
                <span>{formatDuracaoMinutos(duracaoTotal)}</span>
                <span>{concluidos} concluídas</span>
              </div>
            </div>
          </div>

          <div className="library-module-meta">
            <span className="library-module-progress-copy">{concluidos} de {modulo.itens.length} aulas concluídas</span>
            <span className="library-module-toggle-label">{aberta ? 'Fechar aulas' : 'Abrir aulas'}</span>
          </div>
        </button>

        <div className="library-module-progress">
          <div className="student-progress-bar">
            <div className="student-progress-fill" style={{ width: `${progressoPercentual}%` }} />
          </div>
          <div className="mini-copy">{concluidos} de {modulo.itens.length} aulas concluídas</div>
        </div>

        {aberta && <div className="library-module-body">{renderAulas(modulo.itens)}</div>}
      </section>
    )
  }

  function renderBloco({ chave, titulo, subtitulo, modulos }) {
    const totalAulas = modulos.reduce((acc, modulo) => acc + modulo.itens.length, 0)

    return (
      <section key={chave} className="library-section-card">
        <div className="library-section-toggle library-section-toggle--static">
          <div>
            <div className="section-heading">{titulo}</div>
            <div className="section-copy">{subtitulo}</div>
          </div>

          <div className="library-section-meta">
            <span className="card-tag">{modulos.length} módulos</span>
            <span className="library-section-toggle-label">{totalAulas} aulas</span>
          </div>
        </div>

        <div className="library-section-body">
          <div className="student-grid">
            {modulos.map(renderModulo)}
          </div>
        </div>
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
                <div className="student-chip-copy">Ativo até {formatDataCurta(item.fimEm)}</div>
              </div>
            ))}
          </div>
        )}

        <div className="student-filter-card student-filter-card--inline">
          <input
            className="form-input student-filter-input--slim"
            placeholder="Buscar por módulo, aula, local ou tipo..."
            value={filtro}
            onChange={event => setFiltro(event.target.value)}
          />
        </div>
      </div>

      {assinaturasAtivas.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">+</div>
          Sua biblioteca ainda está vazia porque você não possui um plano ativo.
          <div style={{ marginTop: '1rem' }}>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              Ver locais de prova
            </button>
          </div>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">?</div>
          Nenhum conteúdo encontrado com esse filtro.
        </div>
      ) : (
        <>
          {modulosGerais.length > 0 && renderBloco({
            chave: 'gerais',
            titulo: 'Módulos gerais',
            subtitulo: 'Aulas que ajudam em qualquer local, sem precisar repetir o mesmo conteúdo em cada percurso.',
            modulos: modulosGerais,
          })}

          {secoesLocais.map(secao => renderBloco({
            chave: secao.chave,
            titulo: secao.nome,
            subtitulo: 'Módulos específicos deste local, organizados por tema para facilitar a navegação.',
            modulos: secao.modulos,
          }))}
        </>
      )}
    </div>
  )
}
