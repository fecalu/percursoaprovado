import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ContentThumbnail from '../components/ContentThumbnail'
import { assinaturaService, categoriaService, percursoService, progressoService } from '../services/api'
import { filtrarAssinaturasLiberadasAgora } from '../utils/access'
import { formatDataCurta, formatDuracaoMinutos, formatTipoConteudo } from '../utils/formatters'
import { formatarIconeGuia as formatarIconeGuiaSeguro } from '../utils/libraryGuide'
import { resolveMediaUrl } from '../utils/media'

const SEM_MODULO_ID = 'sem-modulo'
const TONE_CLASSES = ['is-tone-green', 'is-tone-gold', 'is-tone-blue', 'is-tone-slate']

function pluralizar(total, singular, plural) {
  return `${total} ${total === 1 ? singular : plural}`
}

function compararTexto(a = '', b = '') {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
}

function ordenarAulas(a, b) {
  const ordemA = a?.ordemExibicao ?? 0
  const ordemB = b?.ordemExibicao ?? 0

  if (ordemA !== ordemB) {
    return ordemA - ordemB
  }

  return compararTexto(a?.titulo, b?.titulo)
}

function normalizarBusca(valor = '') {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function textoContem(termo, ...valores) {
  if (!termo) return true
  return valores.some(valor => normalizarBusca(valor).includes(termo))
}

function aulaCorrespondeBusca(item, termo) {
  return textoContem(
    termo,
    item.titulo,
    item.resumo,
    item.descricao,
    item.categoriaNome,
    item.localProvaNome,
    item.tipoConteudo
  )
}

function guiaCorrespondeBusca(bloco, termo) {
  const itensVisuais = (bloco.itensVisuais || []).flatMap(item => [item.titulo, item.descricao, item.imagemLegenda])
  return textoContem(termo, bloco.titulo, bloco.descricao, bloco.textoDetalhado, bloco.imagemLegenda, bloco.icone, ...itensVisuais)
}

function ordenarGuiaBlocos(a, b) {
  const ordemA = a?.ordemExibicao ?? 0
  const ordemB = b?.ordemExibicao ?? 0

  if (ordemA !== ordemB) {
    return ordemA - ordemB
  }

  return compararTexto(a?.titulo, b?.titulo)
}

function ordenarGuiaItens(a, b) {
  const ordemA = a?.ordemExibicao ?? 0
  const ordemB = b?.ordemExibicao ?? 0

  if (ordemA !== ordemB) {
    return ordemA - ordemB
  }

  return compararTexto(a?.titulo, b?.titulo)
}

function formatarIconeGuia(icone) {
  if (!icone || icone === 'check') return '\u2713'

  const mapa = {
    check: '✓',
    documento: 'DOC',
    local: 'LOC',
    carro: 'CAR',
    alerta: '!',
    tempo: 'H',
    default: 'OK',
  }

  return mapa[icone] || '✓'
}

function ordenarBasesModulo(a, b) {
  const ordemA = a.ordemExibicao ?? Number.MAX_SAFE_INTEGER
  const ordemB = b.ordemExibicao ?? Number.MAX_SAFE_INTEGER

  if (ordemA !== ordemB) {
    return ordemA - ordemB
  }

  return compararTexto(a.nome, b.nome)
}

function resolverStatusConteudo(item, progressoItem) {
  if (!progressoItem) {
    return {
      label: 'Nao iniciado',
      toneClass: 'is-neutral',
      concluido: false,
      progressoPercentual: 0,
      iniciado: false,
    }
  }

  if (progressoItem.concluido) {
    return {
      label: 'Concluido',
      toneClass: 'is-complete',
      concluido: true,
      progressoPercentual: 100,
      iniciado: true,
    }
  }

  const duracaoTotal = progressoItem.duracaoTotal || item?.duracaoSegundos || 0
  const progressoPercentual = duracaoTotal > 0
    ? Math.min(100, Math.round(((progressoItem.segundosAssistidos || 0) / duracaoTotal) * 100))
    : 0

  return {
    label: progressoPercentual > 0 ? 'Em andamento' : 'Nao iniciado',
    toneClass: progressoPercentual > 0 ? 'is-active' : 'is-neutral',
    concluido: false,
    progressoPercentual,
    iniciado: progressoPercentual > 0,
  }
}

function criarBasesModulo(categorias, conteudos) {
  const bases = []
  const idsUsados = new Set()

  categorias
    .map(categoria => ({
      id: categoria.id,
      nome: categoria.nome || 'Modulo sem nome',
      descricao: categoria.descricao || '',
      ordemExibicao: categoria.ordemExibicao ?? Number.MAX_SAFE_INTEGER,
      formatoExperiencia: categoria.formatoExperiencia || 'AULAS',
      guiaBlocos: normalizarGuiaBlocos(categoria.guiaBlocos || []),
    }))
    .sort(ordenarBasesModulo)
    .forEach(categoria => {
      if (!categoria.id || idsUsados.has(categoria.id)) return
      idsUsados.add(categoria.id)
      bases.push(categoria)
    })

  conteudos.forEach(item => {
    if (!item.categoriaId || idsUsados.has(item.categoriaId)) return

    idsUsados.add(item.categoriaId)
    bases.push({
      id: item.categoriaId,
      nome: item.categoriaNome || 'Modulo sem nome',
      descricao: '',
      ordemExibicao: item.categoriaOrdemExibicao ?? Number.MAX_SAFE_INTEGER,
      formatoExperiencia: 'AULAS',
      guiaBlocos: [],
    })
  })

  if (conteudos.some(item => !item.categoriaId)) {
    bases.push({
      id: SEM_MODULO_ID,
      nome: 'Sem modulo',
      descricao: 'Aulas que ainda precisam ser colocadas em um modulo pelo administrador.',
      ordemExibicao: Number.MAX_SAFE_INTEGER,
      formatoExperiencia: 'AULAS',
      guiaBlocos: [],
    })
  }

  return bases.sort(ordenarBasesModulo)
}

function normalizarGuiaBlocos(blocos = []) {
  return [...blocos]
    .filter(bloco => bloco?.titulo)
    .sort(ordenarGuiaBlocos)
    .map(bloco => ({
      ...bloco,
      itensVisuais: [...(bloco.itensVisuais || [])]
        .filter(item => item?.titulo)
        .sort(ordenarGuiaItens),
    }))
}

function obterContextos(itens) {
  const contextos = new Set()

  itens.forEach(item => {
    contextos.add(item.localProvaNome || 'Geral')
  })

  return Array.from(contextos).sort(compararTexto)
}

function resumirContextos(contextos) {
  if (!contextos.length) return 'Aguardando aulas'
  if (contextos.length === 1) return contextos[0]
  return `${contextos.length} locais`
}

function resolverStatusModulo(modulo, proximoModuloChave) {
  if (modulo.totalAulas === 0 && modulo.totalGuiaBlocos > 0) {
    return {
      label: 'GUIA',
      copy: `${modulo.totalGuiaBlocos} passos praticos`,
      className: 'is-current',
    }
  }

  if (modulo.totalAulas === 0) {
    return {
      label: 'EM BREVE',
      copy: 'Etapa prevista, aguardando aula publicada',
      className: 'is-upcoming',
    }
  }

  if (modulo.concluidos >= modulo.totalAulas) {
    return {
      label: 'CONCLUIDA',
      copy: `${modulo.concluidos}/${modulo.totalAulas} aulas concluidas`,
      className: 'is-complete',
    }
  }

  if (modulo.chave === proximoModuloChave) {
    return {
      label: 'AGORA',
      copy: `${modulo.concluidos}/${modulo.totalAulas} aulas concluidas`,
      className: 'is-current',
    }
  }

  if (modulo.iniciado) {
    return {
      label: 'EM ANDAMENTO',
      copy: `${modulo.concluidos}/${modulo.totalAulas} aulas concluidas`,
      className: 'is-progress',
    }
  }

  return {
    label: 'DISPONIVEL',
    copy: `${modulo.totalAulas} aulas prontas`,
    className: 'is-ready',
  }
}

function moduloMostraGuia(modulo) {
  return ['GUIA', 'MISTO'].includes(modulo.formatoExperiencia) && modulo.guiaBlocos.length > 0
}

function moduloMostraAulas(modulo) {
  if (!modulo.itens.length) return false
  if (modulo.formatoExperiencia === 'GUIA' && moduloMostraGuia(modulo)) return false
  return true
}

function obterChaveGuiaBloco(bloco, index) {
  return bloco.id || `${bloco.ordemExibicao ?? index}-${bloco.titulo}`
}

function deveAbrirGuiaEmTela() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }

  return [
    '(max-width: 860px)',
    '(max-width: 1024px) and (pointer: coarse)',
    '(max-width: 1024px) and (hover: none)',
  ].some(query => window.matchMedia(query).matches)
}

export default function Biblioteca() {
  const navigate = useNavigate()
  const [conteudos, setConteudos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [assinaturas, setAssinaturas] = useState([])
  const [progresso, setProgresso] = useState([])
  const [filtro, setFiltro] = useState('')
  const [loading, setLoading] = useState(true)
  const [modulosAbertos, setModulosAbertos] = useState({})
  const [guiaModal, setGuiaModal] = useState(null)

  useEffect(() => {
    let ativo = true

    Promise.allSettled([
      percursoService.listar(),
      categoriaService.listar(),
      assinaturaService.minhas(),
      progressoService.meu(),
    ])
      .then(([conteudosResp, categoriasResp, assinaturasResp, progressoResp]) => {
        if (!ativo) return
        if (conteudosResp.status === 'fulfilled') setConteudos(conteudosResp.value)
        if (categoriasResp.status === 'fulfilled') setCategorias(categoriasResp.value)
        if (assinaturasResp.status === 'fulfilled') setAssinaturas(assinaturasResp.value)
        if (progressoResp.status === 'fulfilled') setProgresso(progressoResp.value)
      })
      .finally(() => {
        if (ativo) setLoading(false)
      })

    return () => {
      ativo = false
    }
  }, [])

  const assinaturasAtivas = useMemo(
    () => filtrarAssinaturasLiberadasAgora(assinaturas),
    [assinaturas]
  )

  const progressoMap = useMemo(() => {
    const map = new Map()
    progresso.forEach(item => {
      map.set(item.percursoId, item)
    })
    return map
  }, [progresso])

  const modulosBiblioteca = useMemo(() => {
    const termo = normalizarBusca(filtro)
    const basesModulo = criarBasesModulo(categorias, conteudos)
    const conteudosPorModulo = new Map()

    conteudos.forEach(item => {
      const chave = item.categoriaId || SEM_MODULO_ID
      const listaAtual = conteudosPorModulo.get(chave) || []
      conteudosPorModulo.set(chave, [...listaAtual, item])
    })

    return basesModulo
      .map((base, index) => {
        const itensOriginais = [...(conteudosPorModulo.get(base.id) || [])].sort(ordenarAulas)
        const guiaBlocosOriginais = normalizarGuiaBlocos(base.guiaBlocos || [])
        const moduloCorresponde = textoContem(termo, base.nome, base.descricao)
        const itensFiltrados = termo ? itensOriginais.filter(item => aulaCorrespondeBusca(item, termo)) : itensOriginais
        const guiaBlocosFiltrados = termo
          ? guiaBlocosOriginais.filter(bloco => guiaCorrespondeBusca(bloco, termo))
          : guiaBlocosOriginais

        if (termo && !moduloCorresponde && itensFiltrados.length === 0 && guiaBlocosFiltrados.length === 0) {
          return null
        }

        const itensVisiveis = moduloCorresponde ? itensOriginais : itensFiltrados
        const guiaBlocosVisiveis = moduloCorresponde ? guiaBlocosOriginais : guiaBlocosFiltrados
        const contextos = obterContextos(itensOriginais)
        const concluidos = itensOriginais.filter(item => resolverStatusConteudo(item, progressoMap.get(item.id)).concluido).length
        const iniciado = itensOriginais.some(item => {
          const status = resolverStatusConteudo(item, progressoMap.get(item.id))
          return status.iniciado && !status.concluido
        })
        const duracaoTotal = itensOriginais.reduce((acc, item) => acc + (item.duracaoSegundos || 0), 0)
        const totalAulas = itensOriginais.length
        const totalGuiaBlocos = guiaBlocosOriginais.length

        return {
          chave: `modulo-${base.id}`,
          id: base.id,
          titulo: base.nome,
          descricao: base.descricao || 'Modulo cadastrado pelo administrador. As aulas aparecem aqui assim que forem publicadas.',
          ordemExibicao: base.ordemExibicao,
          formatoExperiencia: base.formatoExperiencia || 'AULAS',
          itens: itensVisiveis,
          guiaBlocos: guiaBlocosVisiveis,
          totalAulas,
          totalGuiaBlocos,
          concluidos,
          iniciado,
          duracaoTotal,
          progressoPercentual: totalAulas > 0 ? Math.round((concluidos / totalAulas) * 100) : 0,
          contextos,
          contextoResumo: contextos.length ? resumirContextos(contextos) : totalGuiaBlocos > 0 ? 'Guia pratico' : resumirContextos(contextos),
          toneClass: TONE_CLASSES[index % TONE_CLASSES.length],
        }
      })
      .filter(Boolean)
  }, [categorias, conteudos, filtro, progressoMap])

  const totalModulosDisponiveis = useMemo(() => criarBasesModulo(categorias, conteudos).length, [categorias, conteudos])

  const proximoModuloChave = useMemo(() => {
    return modulosBiblioteca.find(modulo => (
      (modulo.totalAulas > 0 && modulo.concluidos < modulo.totalAulas)
      || (modulo.totalAulas === 0 && modulo.totalGuiaBlocos > 0)
    ))?.chave || null
  }, [modulosBiblioteca])

  const resumoGeral = useMemo(() => {
    const concluidos = conteudos.filter(item => resolverStatusConteudo(item, progressoMap.get(item.id)).concluido).length
    const emAndamento = conteudos.filter(item => {
      const status = resolverStatusConteudo(item, progressoMap.get(item.id))
      return status.iniciado && !status.concluido
    }).length

    return {
      modulos: modulosBiblioteca.length,
      emBreve: modulosBiblioteca.filter(modulo => modulo.totalAulas === 0).length,
      concluidos,
      emAndamento,
    }
  }, [conteudos, modulosBiblioteca, progressoMap])

  const filtroAtivo = filtro.trim().length > 0

  useEffect(() => {
    const chavesAtivas = new Set(modulosBiblioteca.map(modulo => modulo.chave))

    setModulosAbertos(prev => {
      const proximo = {}
      chavesAtivas.forEach(chave => {
        proximo[chave] = chave in prev ? prev[chave] : false
      })
      return proximo
    })

  }, [modulosBiblioteca])

  const guiaModalData = useMemo(() => {
    if (!guiaModal) return null

    const modulo = modulosBiblioteca.find(item => item.chave === guiaModal.moduloChave)
    if (!modulo || !modulo.guiaBlocos.length) return null

    const passos = modulo.guiaBlocos.map((bloco, index) => ({
      ...bloco,
      chaveGuia: obterChaveGuiaBloco(bloco, index),
      numeroGuia: index + 1,
    }))
    const indiceSelecionado = Math.max(0, passos.findIndex(bloco => bloco.chaveGuia === guiaModal.passoChave))
    const passo = passos[indiceSelecionado] || passos[0]

    return {
      modulo,
      passos,
      passo,
      indice: passos.indexOf(passo),
    }
  }, [guiaModal, modulosBiblioteca])

  useEffect(() => {
    if (!guiaModal) return undefined

    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function fecharComEsc(event) {
      if (event.key === 'Escape') {
        setGuiaModal(null)
      }
    }

    document.addEventListener('keydown', fecharComEsc)

    return () => {
      document.body.style.overflow = overflowAnterior
      document.removeEventListener('keydown', fecharComEsc)
    }
  }, [guiaModal])

  useEffect(() => {
    if (guiaModal && !guiaModalData) {
      setGuiaModal(null)
    }
  }, [guiaModal, guiaModalData])

  function alternarModulo(chave) {
    setModulosAbertos(prev => {
      const vaiAbrir = !prev[chave]
      const proximo = {}
      Object.keys(prev).forEach(chaveAtual => {
        proximo[chaveAtual] = chaveAtual === chave ? vaiAbrir : false
      })
      if (!(chave in proximo)) {
        proximo[chave] = vaiAbrir
      }
      return proximo
    })
  }

  function moduloEstaAberto(modulo) {
    return Boolean(modulosAbertos[modulo.chave])
  }

  function abrirGuiaModal(modulo, passoChave = null) {
    const primeiroPasso = modulo.guiaBlocos[0]
    if (!primeiroPasso) return

    if (deveAbrirGuiaEmTela() && modulo.id && modulo.id !== SEM_MODULO_ID) {
      navigate(`/biblioteca/modulos/${modulo.id}/guia`, {
        state: {
          modulo: {
            id: modulo.id,
            titulo: modulo.titulo,
            descricao: modulo.descricao,
            guiaBlocos: modulo.guiaBlocos,
          },
        },
      })
      return
    }

    setGuiaModal({
      moduloChave: modulo.chave,
      passoChave: passoChave || obterChaveGuiaBloco(primeiroPasso, 0),
    })
  }

  function selecionarPassoNoModal(passoChave) {
    if (!guiaModalData) return

    setGuiaModal({
      moduloChave: guiaModalData.modulo.chave,
      passoChave,
    })
  }

  function navegarPassoModal(direcao) {
    if (!guiaModalData) return

    const proximoIndice = guiaModalData.indice + direcao
    const proximoPasso = guiaModalData.passos[proximoIndice]
    if (!proximoPasso) return

    selecionarPassoNoModal(proximoPasso.chaveGuia)
  }

  function renderAulas(itens) {
    return (
      <div className="library-lesson-list">
        {itens.map(item => {
          const status = resolverStatusConteudo(item, progressoMap.get(item.id))

          return (
            <button
              key={item.id}
              type="button"
              className={`library-lesson-row${status.concluido ? ' is-concluded' : ''}`}
              onClick={event => {
                event.stopPropagation()
                navigate(`/conteudos/${item.id}`)
              }}
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
                  <span>{item.localProvaNome || 'Geral'}</span>
                  <span>{formatDuracaoMinutos(item.duracaoSegundos)}</span>
                  {status.progressoPercentual > 0 && !status.concluido && (
                    <span>{status.progressoPercentual}% assistido</span>
                  )}
                </div>
              </div>

              <div className="library-lesson-action">
                {status.concluido ? 'Rever' : status.progressoPercentual > 0 ? 'Continuar' : 'Comecar'}
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  function renderGuiaResumo(modulo) {
    return (
      <div className="library-guide-launch-card">
        <div>
          <span className="card-tag">Guia pratico</span>
          <h3>Passo a passo visual</h3>
          <p>Abra o guia em uma janela focada para ver as etapas com ilustracoes e explicacoes.</p>
        </div>

        <div className="library-guide-launch-meta">
          <span>{pluralizar(modulo.totalGuiaBlocos, 'passo', 'passos')}</span>
          <button
            className="btn btn-primary"
            type="button"
            onClick={event => {
              event.stopPropagation()
              abrirGuiaModal(modulo)
            }}
          >
            Abrir guia
          </button>
        </div>
      </div>
    )
  }

  function renderGuiaModal() {
    if (!guiaModalData?.passo) return null

    const { modulo, passos, passo, indice } = guiaModalData
    const exibeCamadaBlocos = passos.length > 1
    const itensVisuais = passo.itensVisuais || []
    const temChecklistVisual = itensVisuais.length > 0
    const textoDetalhado = passo.textoDetalhado || passo.descricao || ''
    const textoFallback = 'Este passo ainda nao tem uma explicacao detalhada cadastrada.'
    const resumoModal = exibeCamadaBlocos
      ? pluralizar(passos.length, 'passo visual', 'passos visuais')
      : temChecklistVisual
        ? pluralizar(itensVisuais.length, 'item visual', 'itens visuais')
        : 'Guia visual do modulo'
    const rotuloConteudo = exibeCamadaBlocos ? `Passo ${passo.numeroGuia}` : temChecklistVisual ? 'Checklist visual' : 'Guia visual'
    const exibeTituloDoPasso = exibeCamadaBlocos || normalizarBusca(passo.titulo) !== normalizarBusca(modulo.titulo)
    const temAnterior = indice > 0
    const temProximo = indice < passos.length - 1

    return (
      <div className="library-guide-modal-backdrop" role="presentation" onClick={() => setGuiaModal(null)}>
        <section
          className={`library-guide-modal${exibeCamadaBlocos ? '' : ' is-single-step'}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="library-guide-modal-title"
          onClick={event => event.stopPropagation()}
        >
          <div className="library-guide-modal-head">
            <div>
              <span className="card-tag">Guia pratico</span>
              <h2 id="library-guide-modal-title">{modulo.titulo}</h2>
              <p>{resumoModal}</p>
            </div>
            <button className="library-guide-modal-close" type="button" onClick={() => setGuiaModal(null)} aria-label="Fechar guia">
              x
            </button>
          </div>

          <div className={`library-guide-workspace library-guide-workspace--modal${exibeCamadaBlocos ? '' : ' is-single-step'}`}>
            {exibeCamadaBlocos ? (
              <div className="library-guide-list library-guide-list--tabs" aria-label="Passos do guia pratico">
                {passos.map(item => {
                  const ativo = item.chaveGuia === passo.chaveGuia

                  return (
                    <button
                      key={item.chaveGuia}
                      type="button"
                      className={`library-guide-step${ativo ? ' is-active' : ''}`}
                      onClick={() => selecionarPassoNoModal(item.chaveGuia)}
                    >
                      <div className="library-guide-step-icon">{formatarIconeGuiaSeguro(item.icone)}</div>
                      <div className="library-guide-step-body">
                        <div className="library-guide-step-title">{item.titulo}</div>
                        {item.descricao ? (
                          <div className="library-guide-step-copy">{item.descricao}</div>
                        ) : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : null}

            <div className="library-guide-visual-card">
              <div className="library-guide-visual-content">
                <span className="card-tag">{rotuloConteudo}</span>
                {exibeTituloDoPasso ? <h3>{passo.titulo}</h3> : null}
                {temChecklistVisual ? (
                  textoDetalhado ? <p>{textoDetalhado}</p> : null
                ) : (
                  <p>{textoDetalhado || textoFallback}</p>
                )}
                {!temChecklistVisual && passo.imagemLegenda ? (
                  <div className="library-guide-visual-caption">{passo.imagemLegenda}</div>
                ) : null}
              </div>

              {temChecklistVisual ? (
                <div className="library-guide-checklist-grid" aria-label="Checklist visual do passo">
                  {itensVisuais.map((item, itemIndex) => (
                    <article key={item.id || `${item.ordemExibicao ?? itemIndex}-${item.titulo}`} className="library-guide-checklist-card">
                      <div className="library-guide-checklist-media">
                        {item.imagemUrl ? (
                          <img src={resolveMediaUrl(item.imagemUrl)} alt={item.imagemLegenda || item.titulo} loading="lazy" />
                        ) : (
                          <div className="library-guide-checklist-placeholder">
                            <span>{formatarIconeGuiaSeguro(passo.icone)}</span>
                          </div>
                        )}
                      </div>

                      <div className="library-guide-checklist-body">
                        <div className="library-guide-checklist-head">
                          <span className="library-guide-checklist-badge">{'\u2713'}</span>
                          <h4>{item.titulo}</h4>
                        </div>
                        {item.descricao ? <p>{item.descricao}</p> : null}
                        {item.imagemLegenda ? (
                          <div className="library-guide-checklist-caption">{item.imagemLegenda}</div>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="library-guide-visual-media">
                  {passo.imagemUrl ? (
                    <img src={resolveMediaUrl(passo.imagemUrl)} alt={passo.imagemLegenda || passo.titulo} loading="lazy" />
                  ) : (
                    <div className="library-guide-visual-placeholder">
                      <span>{formatarIconeGuiaSeguro(passo.icone)}</span>
                      Ilustracao aguardando cadastro
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {exibeCamadaBlocos ? (
            <div className="library-guide-modal-footer">
              <button className="btn btn-ghost" type="button" disabled={!temAnterior} onClick={() => navegarPassoModal(-1)}>
                Anterior
              </button>
              <span>{indice + 1} de {passos.length}</span>
              <button className="btn btn-primary" type="button" disabled={!temProximo} onClick={() => navegarPassoModal(1)}>
                Proximo
              </button>
            </div>
          ) : null}
        </section>
      </div>
    )
  }

  function renderModulo(modulo) {
    const aberta = moduloEstaAberto(modulo)
    const statusModulo = resolverStatusModulo(modulo, proximoModuloChave)
    const mostraGuia = moduloMostraGuia(modulo)
    const mostraAulas = moduloMostraAulas(modulo)
    const podeAbrir = mostraGuia || mostraAulas
    const progressoVisual = modulo.totalAulas > 0 ? modulo.progressoPercentual : modulo.totalGuiaBlocos > 0 ? 100 : 0
    const alternarModuloAtual = () => {
      if (!podeAbrir) return

      if (mostraGuia && !mostraAulas) {
        abrirGuiaModal(modulo)
        return
      }

      alternarModulo(modulo.chave)
    }

    return (
      <article
        key={modulo.chave}
        className={`library-module-tile ${modulo.toneClass} ${statusModulo.className}${podeAbrir ? ' is-clickable' : ''}${aberta ? ' is-open' : ''}`.trim()}
        role={podeAbrir ? 'button' : undefined}
        tabIndex={podeAbrir ? 0 : undefined}
        aria-expanded={mostraAulas ? aberta : undefined}
        aria-haspopup={mostraGuia && !mostraAulas ? 'dialog' : undefined}
        onClick={alternarModuloAtual}
        onKeyDown={event => {
          if (!podeAbrir) return
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            alternarModuloAtual()
          }
        }}
      >
        <div className="library-module-tile-top">
          <span className="library-module-stage-badge">{statusModulo.label}</span>
          <span className="library-module-stage-meta">{statusModulo.copy}</span>
        </div>

        <div className="library-module-tile-main">
          <h2 className="library-module-tile-title">{modulo.titulo}</h2>
          <p className="library-module-tile-copy">{modulo.descricao}</p>
        </div>

        <div className="library-module-tile-tags">
          {modulo.totalGuiaBlocos > 0 && <span>{pluralizar(modulo.totalGuiaBlocos, 'passo pratico', 'passos praticos')}</span>}
          {modulo.totalAulas > 0 && <span>{pluralizar(modulo.totalAulas, 'aula pronta', 'aulas prontas')}</span>}
          {modulo.totalGuiaBlocos === 0 && modulo.totalAulas === 0 && <span>Sem aulas agora</span>}
          {modulo.duracaoTotal > 0 && <span>{formatDuracaoMinutos(modulo.duracaoTotal)}</span>}
        </div>

        <div className="library-module-tile-progress">
          <div className="student-progress-bar">
            <div className="student-progress-fill" style={{ width: `${progressoVisual}%` }} />
          </div>
          <span>
            {modulo.totalAulas > 0
              ? `${modulo.progressoPercentual}% concluido`
              : modulo.totalGuiaBlocos > 0 ? 'Guia pratico disponivel' : 'Aguardando publicacao'}
          </span>
        </div>

        <div className="library-module-tile-footer">
          <span className="library-module-context">{modulo.contextoResumo}</span>
          <span className="library-module-open-hint">
            {!podeAbrir ? 'Aguardando aulas' : mostraGuia && !mostraAulas ? 'Abrir guia' : aberta ? 'Fechar modulo' : 'Clique para abrir'}
          </span>
        </div>

        {aberta && podeAbrir && (
          <div className="library-module-open-panel library-module-open-panel--inline" onClick={event => event.stopPropagation()}>
            {mostraGuia && renderGuiaResumo(modulo)}
            {mostraGuia && mostraAulas && <div className="library-guide-lesson-heading">Aulas complementares</div>}
            {mostraAulas && renderAulas(modulo.itens)}
          </div>
        )}
      </article>
    )
  }

  if (loading) return <div className="spinner" />

  return (
    <div className="student-library-page student-library-page--modules">
      {assinaturasAtivas.length > 0 && (
        <div className="student-shell student-shell--compact">
          <div className="student-chip-grid student-chip-grid--compact">
            {assinaturasAtivas.map(item => (
              <div key={item.id} className="student-chip student-chip--compact">
                <div className="student-chip-title">{item.localProvaNome}</div>
                <div className="student-chip-copy">Ativo ate {formatDataCurta(item.fimEm)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {assinaturasAtivas.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">+</div>
          Sua biblioteca ainda esta vazia porque voce nao possui um acesso ativo.
          <div style={{ marginTop: '1rem' }}>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              Ver locais de prova
            </button>
          </div>
        </div>
      ) : totalModulosDisponiveis === 0 && !filtroAtivo ? (
        <div className="empty-state">
          <div className="empty-state-icon">?</div>
          Nenhum modulo cadastrado ainda. Assim que o administrador criar modulos, eles aparecem aqui.
        </div>
      ) : (
        <section className="content-section library-module-board-section">
          <div className="section-title-row library-module-board-head">
            <div className="library-module-board-title">
              <div className="section-heading">Modulos de estudo</div>
              <div className="student-filter-card student-filter-card--inline library-module-board-search">
                <input
                  className="form-input student-filter-input--slim"
                  placeholder="Buscar na biblioteca..."
                  value={filtro}
                  onChange={event => setFiltro(event.target.value)}
                />
              </div>
            </div>

            <div className="student-dashboard-inline-points">
              <span className="student-dashboard-inline-pill">{pluralizar(modulosBiblioteca.length, 'modulo', 'modulos')}</span>
              <span className="student-dashboard-inline-pill">{pluralizar(conteudos.length, 'aula liberada', 'aulas liberadas')}</span>
              {resumoGeral.emAndamento > 0 && (
                <span className="student-dashboard-inline-pill">{pluralizar(resumoGeral.emAndamento, 'em andamento', 'em andamento')}</span>
              )}
            </div>
          </div>

          {modulosBiblioteca.length === 0 ? (
            <div className="empty-state library-module-empty-result">
              <div className="empty-state-icon">?</div>
              Nenhum modulo ou aula encontrado com esse filtro.
            </div>
          ) : (
            <div className="library-module-board">
              {modulosBiblioteca.map(renderModulo)}
            </div>
          )}
        </section>
      )}

      {renderGuiaModal()}
    </div>
  )
}
