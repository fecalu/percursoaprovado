import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { assinaturaService, categoriaService } from '../services/api'
import { filtrarAssinaturasLiberadasAgora } from '../utils/access'
import {
  formatarIconeGuia,
  normalizarBusca,
  normalizarGuiaBlocos,
  obterChaveGuiaBloco,
  pluralizar,
} from '../utils/libraryGuide'
import { resolveMediaUrl } from '../utils/media'

export default function BibliotecaGuia() {
  const location = useLocation()
  const navigate = useNavigate()
  const { moduloId } = useParams()
  const [categorias, setCategorias] = useState([])
  const [assinaturas, setAssinaturas] = useState([])
  const [loading, setLoading] = useState(true)
  const [passoChave, setPassoChave] = useState(null)

  useEffect(() => {
    let ativo = true

    Promise.allSettled([
      categoriaService.listar(),
      assinaturaService.minhas(),
    ])
      .then(([categoriasResp, assinaturasResp]) => {
        if (!ativo) return
        if (categoriasResp.status === 'fulfilled') setCategorias(categoriasResp.value)
        if (assinaturasResp.status === 'fulfilled') setAssinaturas(assinaturasResp.value)
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

  const moduloNavegado = useMemo(() => {
    const modulo = location.state?.modulo
    if (!modulo || String(modulo.id) !== String(moduloId)) return null

    return {
      id: modulo.id,
      titulo: modulo.titulo || 'Modulo sem nome',
      descricao: modulo.descricao || '',
      guiaBlocos: normalizarGuiaBlocos(modulo.guiaBlocos || []),
    }
  }, [location.state, moduloId])

  const modulo = useMemo(() => {
    const categoria = categorias.find(item => String(item.id) === String(moduloId))
    if (!categoria) return moduloNavegado

    return {
      id: categoria.id,
      titulo: categoria.nome || 'Modulo sem nome',
      descricao: categoria.descricao || '',
      guiaBlocos: normalizarGuiaBlocos(categoria.guiaBlocos || []),
    }
  }, [categorias, moduloId, moduloNavegado])

  const passos = useMemo(() => (
    modulo?.guiaBlocos.map((bloco, index) => ({
      ...bloco,
      chaveGuia: obterChaveGuiaBloco(bloco, index),
      numeroGuia: index + 1,
    })) || []
  ), [modulo])

  useEffect(() => {
    if (!passos.length) {
      setPassoChave(null)
      return
    }

    setPassoChave(current => (
      passos.some(item => item.chaveGuia === current)
        ? current
        : passos[0].chaveGuia
    ))
  }, [passos])

  const passo = useMemo(
    () => passos.find(item => item.chaveGuia === passoChave) || passos[0] || null,
    [passoChave, passos]
  )

  const exibeCamadaBlocos = passos.length > 1
  const itensVisuais = passo?.itensVisuais || []
  const temChecklistVisual = itensVisuais.length > 0
  const textoDetalhado = passo?.textoDetalhado || passo?.descricao || ''
  const textoFallback = 'Este passo ainda nao tem uma explicacao detalhada cadastrada.'
  const resumoTela = exibeCamadaBlocos
    ? pluralizar(passos.length, 'etapa visual', 'etapas visuais')
    : temChecklistVisual
      ? pluralizar(itensVisuais.length, 'item visual', 'itens visuais')
      : 'Guia visual do modulo'
  const rotuloConteudo = exibeCamadaBlocos ? `Etapa ${passo?.numeroGuia || 1}` : temChecklistVisual ? 'Checklist visual' : 'Guia visual'
  const exibeTituloDoPasso = passo && (exibeCamadaBlocos || normalizarBusca(passo.titulo) !== normalizarBusca(modulo?.titulo))

  function voltarParaBiblioteca() {
    navigate('/biblioteca')
  }

  function selecionarPasso(chave) {
    setPassoChave(chave)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading && !moduloNavegado) return <div className="spinner" />

  if (!loading && !assinaturasAtivas.length) {
    return (
      <div className="student-library-page student-library-page--guide-screen">
        <div className="empty-state">
          <div className="empty-state-icon">+</div>
          Seu guia pratico ainda nao esta liberado porque voce nao possui um acesso ativo.
          <div style={{ marginTop: '1rem' }}>
            <button className="btn btn-primary" onClick={voltarParaBiblioteca}>
              Voltar para a biblioteca
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!loading && (!modulo || !passos.length || !passo)) {
    return (
      <div className="student-library-page student-library-page--guide-screen">
        <div className="empty-state">
          <div className="empty-state-icon">?</div>
          Este guia nao foi encontrado ou ainda nao tem etapas publicadas.
          <div style={{ marginTop: '1rem' }}>
            <button className="btn btn-primary" onClick={voltarParaBiblioteca}>
              Voltar para a biblioteca
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="student-library-page student-library-page--guide-screen">
      <section className="content-section library-guide-screen">
        <div className="library-guide-screen-topbar">
          <button className="library-guide-screen-back" type="button" onClick={voltarParaBiblioteca}>
            Voltar para a biblioteca
          </button>

          <div className="library-guide-screen-head">
            <span className="card-tag">Guia pratico</span>
            <h1>{modulo.titulo}</h1>
            <p>{resumoTela}</p>
          </div>

          {exibeCamadaBlocos ? (
            <div className="library-guide-screen-stepbar" aria-label="Etapas do guia pratico">
              {passos.map(item => {
                const ativo = item.chaveGuia === passo.chaveGuia

                return (
                  <button
                    key={item.chaveGuia}
                    type="button"
                    className={`library-guide-screen-step-pill${ativo ? ' is-active' : ''}`}
                    onClick={() => selecionarPasso(item.chaveGuia)}
                  >
                    <span className="library-guide-screen-step-pill-index">{item.numeroGuia}</span>
                    <span className="library-guide-screen-step-pill-title">{item.titulo}</span>
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>

        <div className="library-guide-visual-card library-guide-visual-card--screen">
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
                        <span>{formatarIconeGuia(passo.icone)}</span>
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
                  <span>{formatarIconeGuia(passo.icone)}</span>
                  Ilustracao aguardando cadastro
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
