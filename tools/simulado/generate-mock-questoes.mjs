import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const outputPath = path.resolve(process.argv[2] || path.resolve('tools', 'simulado', 'output', 'mock-questoes-producao.json'))

const specs = [
  ['LEGISLACAO', 'Ao se aproximar de uma faixa de pedestres sem semaforo, o condutor deve:', 'Dar prioridade ao pedestre', ['Acelerar para liberar a via', 'Dar prioridade ao pedestre', 'Buzinar para alertar o pedestre', 'Parar apenas se houver agente de transito']],
  ['LEGISLACAO', 'Em via urbana, o cinto de seguranca deve ser usado:', 'Por condutor e passageiros', ['Somente pelo condutor', 'Somente em rodovias', 'Por condutor e passageiros', 'Apenas no banco dianteiro']],
  ['LEGISLACAO', 'O condutor que estaciona sobre a calcada comete infracao:', 'Media', ['Leve', 'Media', 'Grave', 'Gravissima']],
  ['LEGISLACAO', 'O documento que autoriza o veiculo a circular regularmente e o:', 'CRLV', ['CRV', 'CRLV', 'CNH', 'RENAVAM']],
  ['LEGISLACAO', 'Antes de mudar de faixa, o condutor deve:', 'Sinalizar e observar retrovisores', ['Frear bruscamente', 'Ligar o pisca-alerta', 'Sinalizar e observar retrovisores', 'Buzinar continuamente']],
  ['DIRECAO_DEFENSIVA', 'Direcao defensiva e a pratica de dirigir com foco em:', 'Prevenir acidentes', ['Chegar mais rapido ao destino', 'Prevenir acidentes', 'Aumentar a velocidade media', 'Reduzir o uso do cinto']],
  ['DIRECAO_DEFENSIVA', 'Ao dirigir sob chuva forte, o condutor deve:', 'Reduzir a velocidade', ['Aumentar a velocidade para sair logo da area', 'Reduzir a velocidade', 'Dirigir com uma so mao', 'Desligar os farois']],
  ['DIRECAO_DEFENSIVA', 'A distancia de seguranca entre veiculos deve considerar:', 'Velocidade, via e clima', ['Apenas o tipo de combustivel', 'Somente a cor do veiculo da frente', 'Velocidade, via e clima', 'Apenas o horario do dia']],
  ['DIRECAO_DEFENSIVA', 'Em caso de ofuscamento por farol alto, o correto e:', 'Reduzir e usar referencia lateral', ['Fechar os olhos por um instante', 'Acelerar para passar rapido', 'Reduzir e usar referencia lateral', 'Ligar o pisca-alerta']],
  ['DIRECAO_DEFENSIVA', 'O uso do celular ao volante aumenta o risco porque:', 'Diminui a atencao do condutor', ['Facilita o controle do veiculo', 'Diminui a atencao do condutor', 'Melhora a visao periferica', 'Aumenta a estabilidade do carro']],
  ['PLACAS', 'A placa de parada obrigatoria determina que o condutor deve:', 'Parar totalmente', ['Reduzir apenas se houver pedestres', 'Parar totalmente', 'Acelerar para liberar a via', 'Buzinar antes de cruzar']],
  ['PLACAS', 'A placa de regulamentacao tem como funcao principal:', 'Mostrar obrigacoes e restricoes', ['Indicar pontos turisticos', 'Mostrar obrigacoes e restricoes', 'Decorar o trajeto', 'Substituir a sinalizacao semaforica']],
  ['PLACAS', 'A placa de advertencia serve para:', 'Alertar para situacoes de risco', ['Autorizar estacionar em qualquer local', 'Alertar para situacoes de risco', 'Informar postos de combustivel', 'Substituir o cinto de seguranca']],
  ['PLACAS', 'A cor vermelha nas placas de regulamentacao normalmente indica:', 'Proibicao ou restricao', ['Orientacao turistica', 'Proibicao ou restricao', 'Informacao de servicos', 'Ponto de interesse historico']],
  ['PLACAS', 'Uma placa educativa tem o objetivo de:', 'Orientar condutas seguras', ['Determinar o valor da multa', 'Orientar condutas seguras', 'Dispensar o uso do cinto', 'Liberar conversao proibida']],
  ['PRIMEIROS_SOCORROS', 'Ao encontrar uma vitima consciente com suspeita de fratura, o mais adequado e:', 'Imobilizar e chamar socorro', ['Pedir para a vitima andar', 'Imobilizar e chamar socorro', 'Dar alimento imediatamente', 'Retirar o capacete a forca']],
  ['PRIMEIROS_SOCORROS', 'O SAMU deve ser acionado pelo numero:', '192', ['190', '191', '192', '193']],
  ['PRIMEIROS_SOCORROS', 'Em caso de hemorragia externa visivel, deve-se:', 'Comprimir o local', ['Lavar com combustivel', 'Comprimir o local', 'Oferecer bebida alcoolica', 'Movimentar bastante o membro']],
  ['MECANICA_BASICA', 'O extintor do veiculo deve estar:', 'Em local acessivel e regular', ['Em local de dificil acesso', 'Apenas no porta-malas solto', 'Em local acessivel e regular', 'Sempre descarregado']],
  ['MECANICA_BASICA', 'Pneus muito gastos podem causar:', 'Maior risco de derrapagem', ['Aumento de aderencia', 'Reducao do risco em chuva', 'Maior risco de derrapagem', 'Menor necessidade de manutencao']],
  ['MECANICA_BASICA', 'O nivel baixo de oleo do motor pode provocar:', 'Danos ao motor', ['Melhor lubrificacao', 'Maior economia de combustivel garantida', 'Danos ao motor', 'Melhora imediata da aceleracao']],
  ['MECANICA_BASICA', 'O sistema de arrefecimento tem a funcao de:', 'Resfriar o motor', ['Aumentar o som do escapamento', 'Resfriar o motor', 'Substituir o sistema eletrico', 'Diminuir a visibilidade do painel']],
  ['MECANICA_BASICA', 'A calibragem incorreta dos pneus pode afetar:', 'Estabilidade e consumo', ['Somente a cor do veiculo', 'Estabilidade e consumo', 'A quilometragem do odometro apenas', 'Apenas o retrovisor interno']],
  ['MEIO_AMBIENTE_CIDADANIA', 'Reduzir o uso do automovel quando possivel contribui para:', 'Reduzir impactos ambientais', ['Aumentar a poluicao', 'Reduzir impactos ambientais', 'Eliminar a manutencao do veiculo', 'Tornar o transito mais agressivo']],
  ['MEIO_AMBIENTE_CIDADANIA', 'O respeito ao ciclista e ao pedestre demonstra:', 'Cidadania no transito', ['Falta de educacao no transito', 'Cidadania no transito', 'Perda de tempo obrigatoria', 'Desinteresse pela coletividade']],
  ['MEIO_AMBIENTE_CIDADANIA', 'Manter o veiculo regulado ajuda principalmente a:', 'Reduzir poluicao', ['Aumentar a emissao de fumaca', 'Reduzir poluicao', 'Dispensar revisoes', 'Eliminar a necessidade de pneus']],
  ['MEIO_AMBIENTE_CIDADANIA', 'A convivencia harmoniosa no transito depende de:', 'Respeito e responsabilidade', ['Competicao entre condutores', 'Respeito e responsabilidade', 'Uso frequente de buzina', 'Excesso de velocidade']],
  ['MEIO_AMBIENTE_CIDADANIA', 'Jogar lixo pela janela do veiculo e uma atitude:', 'Poluidora e inadequada', ['Sustentavel', 'Correta em rodovias', 'Poluidora e inadequada', 'Obrigatoria em viagens longas']],
  ['LEGISLACAO', 'O processo de primeira habilitacao exige do candidato, entre outras etapas:', 'Etapas medicas, teoricas e praticas', ['Apenas comprar o veiculo', 'Somente prova pratica', 'Etapas medicas, teoricas e praticas', 'Somente indicar um fiador']],
  ['LEGISLACAO', 'Em um cruzamento sem sinalizacao, a preferencia deve observar:', 'As regras gerais de preferencia', ['Quem buzinar primeiro passa', 'Quem estiver mais rapido passa', 'As regras gerais de preferencia', 'Nao existe regra aplicavel']]
]

const questoes = specs.map(([tema, enunciado, correta, alternativas], index) => ({
  enunciado: `[MOCK] ${enunciado}`,
  imagemUrl: null,
  tema,
  dificuldade: index % 3 === 0 ? 'FACIL' : 'MEDIA',
  status: 'RASCUNHO',
  explicacaoCurta: `[MOCK] Alternativa correta: ${correta}.`,
  explicacaoDetalhada: '[MOCK] Questao criada apenas para validar o fluxo de importacao em producao.',
  videoUrl: null,
  ordemExibicao: 0,
  origem: 'MOCK_IMPORT',
  origemQuestaoId: `mock-${String(index + 1).padStart(3, '0')}`,
  fingerprint: `mock-import-${String(index + 1).padStart(3, '0')}`,
  alternativas: alternativas.map((texto, ordem) => ({
    texto,
    imagemUrl: null,
    ordem,
    correta: texto === correta,
  })),
}))

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify({ source: 'mock', generatedAt: new Date().toISOString(), questoes }, null, 2)}\n`, 'utf8')
console.log(`Arquivo gerado em: ${outputPath}`)
