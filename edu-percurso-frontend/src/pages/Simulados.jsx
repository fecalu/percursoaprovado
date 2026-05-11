import { useNavigate } from 'react-router-dom'

export default function Simulados() {
  const navigate = useNavigate()

  return (
    <div className="student-shell student-shell--compact">
      <section className="student-card">
        <span className="badge badge-blue">Simulados</span>
        <h1 className="student-card-title">Escolha o tipo de simulado</h1>
        <p className="student-card-copy">
          Separe seu momento de prova entre teoria e pratica. O teorico ja esta pronto para rodada completa e o pratico
          ganhou seu proprio espaco para evoluir com regras proprias.
        </p>
      </section>

      <div className="simulados-hub-grid">
        <article className="student-card simulados-hub-card">
          <span className="badge badge-green">Pronto para usar</span>
          <h2 className="student-card-title">Simulado teorico</h2>
          <p className="student-card-copy">
            Rode uma prova completa com 30 questoes, tempo correndo e nota minima para passar.
          </p>
          <div className="student-card-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/simulado/teorico')}>
              Abrir simulado teorico
            </button>
          </div>
        </article>

        <article className="student-card simulados-hub-card">
          <span className="badge badge-blue">Nova frente</span>
          <h2 className="student-card-title">Simulado pratico</h2>
          <p className="student-card-copy">
            Entre em uma rodada com foco em baliza, controle do veiculo, faltas eliminatorias e leitura de prova.
          </p>
          <div className="student-card-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/simulado/pratico')}>
              Abrir simulado pratico
            </button>
          </div>
        </article>
      </div>
    </div>
  )
}
