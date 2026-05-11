package com.edupercurso.service;

import com.edupercurso.dto.QuestaoAlunoDTO;
import com.edupercurso.dto.QuestaoDTO;
import com.edupercurso.dto.QuestaoImportDTO;
import com.edupercurso.entity.QuestaoAlternativa;
import com.edupercurso.entity.QuestaoTeorica;
import com.edupercurso.entity.RespostaQuestaoAluno;
import com.edupercurso.entity.Usuario;
import com.edupercurso.repository.QuestaoTeoricaRepository;
import com.edupercurso.repository.RespostaQuestaoAlunoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class QuestaoTeoricaService {

    private static final int TOTAL_QUESTOES_SIMULADO_COMPLETO_TEORICO = 30;
    private static final int TOTAL_QUESTOES_SIMULADO_COMPLETO_PRATICO = 20;

    private final QuestaoTeoricaRepository questaoTeoricaRepository;
    private final RespostaQuestaoAlunoRepository respostaQuestaoAlunoRepository;
    private final UsuarioLookupService usuarioLookupService;

    public List<QuestaoDTO.Response> listarAdmin(String busca,
                                                 QuestaoTeorica.Modalidade modalidade,
                                                 QuestaoTeorica.Tema tema,
                                                 QuestaoTeorica.Status status) {
        String termo = busca == null ? "" : busca.trim().toLowerCase();

        return questaoTeoricaRepository.findAll().stream()
                .filter(questao -> termo.isBlank() || correspondeBusca(questao, termo))
                .filter(questao -> modalidade == null || questao.getModalidade() == modalidade)
                .filter(questao -> tema == null || questao.getTema() == tema)
                .filter(questao -> status == null || questao.getStatus() == status)
                .sorted(Comparator
                        .comparing(QuestaoTeorica::getOrdemExibicao, Comparator.nullsLast(Integer::compareTo))
                        .thenComparing(QuestaoTeorica::getCriadoEm, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(QuestaoDTO.Response::from)
                .toList();
    }

    public List<QuestaoAlunoDTO.TemaResumoResponse> listarTemasDisponiveis(QuestaoTeorica.Modalidade modalidade) {
        Map<QuestaoTeorica.Tema, Long> totais = questaoTeoricaRepository
                .findByStatusAndModalidade(QuestaoTeorica.Status.PUBLICADA, normalizarModalidade(modalidade)).stream()
                .collect(Collectors.groupingBy(QuestaoTeorica::getTema, Collectors.counting()));

        return totais.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> QuestaoAlunoDTO.TemaResumoResponse.from(entry.getKey(), entry.getValue()))
                .toList();
    }

    public List<QuestaoAlunoDTO.QuestaoTreinoResponse> listarTreino(QuestaoTeorica.Modalidade modalidade,
                                                                    QuestaoTeorica.Tema tema) {
        QuestaoTeorica.Modalidade modalidadeNormalizada = normalizarModalidade(modalidade);
        List<QuestaoTeorica> questoes = tema == null
                ? questaoTeoricaRepository.findByStatusAndModalidade(QuestaoTeorica.Status.PUBLICADA, modalidadeNormalizada)
                : questaoTeoricaRepository.findByStatusAndModalidadeAndTema(QuestaoTeorica.Status.PUBLICADA, modalidadeNormalizada, tema);

        return questoes.stream()
                .sorted(Comparator
                        .comparing(QuestaoTeorica::getOrdemExibicao, Comparator.nullsLast(Integer::compareTo))
                        .thenComparing(QuestaoTeorica::getCriadoEm, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(QuestaoAlunoDTO.QuestaoTreinoResponse::from)
                .toList();
    }

    public List<QuestaoAlunoDTO.QuestaoTreinoResponse> listarSimuladoCompleto(QuestaoTeorica.Modalidade modalidade,
                                                                               List<UUID> excluirIds) {
        QuestaoTeorica.Modalidade modalidadeNormalizada = normalizarModalidade(modalidade);
        int totalQuestoes = modalidadeNormalizada == QuestaoTeorica.Modalidade.PRATICO
                ? TOTAL_QUESTOES_SIMULADO_COMPLETO_PRATICO
                : TOTAL_QUESTOES_SIMULADO_COMPLETO_TEORICO;
        List<QuestaoTeorica> publicadas = questaoTeoricaRepository.findByStatusAndModalidade(
                QuestaoTeorica.Status.PUBLICADA,
                modalidadeNormalizada
        );
        if (publicadas.size() < totalQuestoes) {
            return List.of();
        }

        if (modalidadeNormalizada == QuestaoTeorica.Modalidade.PRATICO) {
            return montarSimuladoPratico(publicadas, excluirIds);
        }

        Set<UUID> idsExcluidos = excluirIds == null ? Set.of() : new HashSet<>(excluirIds);
        List<QuestaoTeorica> poolBase = publicadas.stream()
                .filter(questao -> !idsExcluidos.contains(questao.getId()))
                .toList();

        List<QuestaoTeorica> candidatas = poolBase.size() >= TOTAL_QUESTOES_SIMULADO_COMPLETO_TEORICO ? poolBase : publicadas;

        Map<QuestaoTeorica.Tema, List<QuestaoTeorica>> questoesPorTema = candidatas.stream()
                .collect(Collectors.groupingBy(QuestaoTeorica::getTema, () -> new EnumMap<>(QuestaoTeorica.Tema.class), Collectors.toList()));

        questoesPorTema.values().forEach(Collections::shuffle);

        List<QuestaoTeorica> selecionadas = new ArrayList<>();
        Set<UUID> idsSelecionados = new HashSet<>();

        adicionarQuestoes(selecionadas, idsSelecionados, combinarQuestoes(questoesPorTema,
                QuestaoTeorica.Tema.LEGISLACAO,
                QuestaoTeorica.Tema.PLACAS), 12);
        adicionarQuestoes(selecionadas, idsSelecionados, questoesPorTema.getOrDefault(QuestaoTeorica.Tema.DIRECAO_DEFENSIVA, List.of()), 10);
        adicionarQuestoes(selecionadas, idsSelecionados, questoesPorTema.getOrDefault(QuestaoTeorica.Tema.PRIMEIROS_SOCORROS, List.of()), 3);
        adicionarQuestoes(selecionadas, idsSelecionados, questoesPorTema.getOrDefault(QuestaoTeorica.Tema.MEIO_AMBIENTE_CIDADANIA, List.of()), 3);
        adicionarQuestoes(selecionadas, idsSelecionados, questoesPorTema.getOrDefault(QuestaoTeorica.Tema.MECANICA_BASICA, List.of()), 2);

        if (selecionadas.size() < TOTAL_QUESTOES_SIMULADO_COMPLETO_TEORICO) {
            List<QuestaoTeorica> restantes = new ArrayList<>(candidatas.stream()
                    .filter(questao -> !idsSelecionados.contains(questao.getId()))
                    .toList());
            Collections.shuffle(restantes);
            restantes.stream()
                    .limit(TOTAL_QUESTOES_SIMULADO_COMPLETO_TEORICO - selecionadas.size())
                    .forEach(questao -> {
                        if (idsSelecionados.add(questao.getId())) {
                            selecionadas.add(questao);
                        }
                    });
        }

        if (selecionadas.size() < TOTAL_QUESTOES_SIMULADO_COMPLETO_TEORICO && candidatas != publicadas) {
            List<QuestaoTeorica> restantesExcluidas = new ArrayList<>(publicadas.stream()
                    .filter(questao -> !idsSelecionados.contains(questao.getId()))
                    .toList());
            Collections.shuffle(restantesExcluidas);
            restantesExcluidas.stream()
                    .limit(TOTAL_QUESTOES_SIMULADO_COMPLETO_TEORICO - selecionadas.size())
                    .forEach(questao -> {
                        if (idsSelecionados.add(questao.getId())) {
                            selecionadas.add(questao);
                        }
                    });
        }

        Collections.shuffle(selecionadas);

        return selecionadas.stream()
                .limit(TOTAL_QUESTOES_SIMULADO_COMPLETO_TEORICO)
                .map(QuestaoAlunoDTO.QuestaoTreinoResponse::from)
                .toList();
    }

    private List<QuestaoAlunoDTO.QuestaoTreinoResponse> montarSimuladoPratico(List<QuestaoTeorica> publicadas,
                                                                              List<UUID> excluirIds) {
        Set<UUID> idsExcluidos = excluirIds == null ? Set.of() : new HashSet<>(excluirIds);
        List<QuestaoTeorica> poolBase = publicadas.stream()
                .filter(questao -> !idsExcluidos.contains(questao.getId()))
                .toList();

        List<QuestaoTeorica> candidatas = poolBase.size() >= TOTAL_QUESTOES_SIMULADO_COMPLETO_PRATICO
                ? poolBase
                : publicadas;

        Map<QuestaoTeorica.Tema, List<QuestaoTeorica>> questoesPorTema = candidatas.stream()
                .collect(Collectors.groupingBy(QuestaoTeorica::getTema, () -> new EnumMap<>(QuestaoTeorica.Tema.class), Collectors.toList()));

        questoesPorTema.values().forEach(Collections::shuffle);

        List<QuestaoTeorica> selecionadas = new ArrayList<>();
        Set<UUID> idsSelecionados = new HashSet<>();

        adicionarQuestoes(selecionadas, idsSelecionados, questoesPorTema.getOrDefault(QuestaoTeorica.Tema.BALIZA, List.of()), 4);
        adicionarQuestoes(selecionadas, idsSelecionados, questoesPorTema.getOrDefault(QuestaoTeorica.Tema.CONTROLE_DO_VEICULO, List.of()), 4);
        adicionarQuestoes(selecionadas, idsSelecionados, questoesPorTema.getOrDefault(QuestaoTeorica.Tema.PREFERENCIA, List.of()), 3);
        adicionarQuestoes(selecionadas, idsSelecionados, questoesPorTema.getOrDefault(QuestaoTeorica.Tema.LADEIRA, List.of()), 2);
        adicionarQuestoes(selecionadas, idsSelecionados, questoesPorTema.getOrDefault(QuestaoTeorica.Tema.CONVERSOES, List.of()), 2);
        adicionarQuestoes(selecionadas, idsSelecionados, questoesPorTema.getOrDefault(QuestaoTeorica.Tema.ESTACIONAMENTO, List.of()), 2);
        adicionarQuestoes(selecionadas, idsSelecionados, questoesPorTema.getOrDefault(QuestaoTeorica.Tema.FALTAS_ELIMINATORIAS, List.of()), 2);
        adicionarQuestoes(selecionadas, idsSelecionados, questoesPorTema.getOrDefault(QuestaoTeorica.Tema.CONDUTA_NA_PROVA, List.of()), 1);

        if (selecionadas.size() < TOTAL_QUESTOES_SIMULADO_COMPLETO_PRATICO) {
            List<QuestaoTeorica> restantes = new ArrayList<>(candidatas.stream()
                    .filter(questao -> !idsSelecionados.contains(questao.getId()))
                    .toList());
            Collections.shuffle(restantes);
            restantes.stream()
                    .limit(TOTAL_QUESTOES_SIMULADO_COMPLETO_PRATICO - selecionadas.size())
                    .forEach(questao -> {
                        if (idsSelecionados.add(questao.getId())) {
                            selecionadas.add(questao);
                        }
                    });
        }

        if (selecionadas.size() < TOTAL_QUESTOES_SIMULADO_COMPLETO_PRATICO && candidatas != publicadas) {
            List<QuestaoTeorica> restantesExcluidas = new ArrayList<>(publicadas.stream()
                    .filter(questao -> !idsSelecionados.contains(questao.getId()))
                    .toList());
            Collections.shuffle(restantesExcluidas);
            restantesExcluidas.stream()
                    .limit(TOTAL_QUESTOES_SIMULADO_COMPLETO_PRATICO - selecionadas.size())
                    .forEach(questao -> {
                        if (idsSelecionados.add(questao.getId())) {
                            selecionadas.add(questao);
                        }
                    });
        }

        Collections.shuffle(selecionadas);

        return selecionadas.stream()
                .map(QuestaoAlunoDTO.QuestaoTreinoResponse::from)
                .toList();
    }

    private List<QuestaoTeorica> combinarQuestoes(Map<QuestaoTeorica.Tema, List<QuestaoTeorica>> questoesPorTema,
                                                  QuestaoTeorica.Tema... temas) {
        List<QuestaoTeorica> combinadas = new ArrayList<>();
        for (QuestaoTeorica.Tema tema : temas) {
            combinadas.addAll(questoesPorTema.getOrDefault(tema, List.of()));
        }
        Collections.shuffle(combinadas);
        return combinadas;
    }

    private void adicionarQuestoes(List<QuestaoTeorica> selecionadas,
                                   Set<UUID> idsSelecionados,
                                   List<QuestaoTeorica> candidatas,
                                   int limite) {
        candidatas.stream()
                .limit(limite)
                .forEach(questao -> {
                    if (idsSelecionados.add(questao.getId())) {
                        selecionadas.add(questao);
                    }
                });
    }

    public QuestaoDTO.Response buscarAdmin(UUID id) {
        return QuestaoDTO.Response.from(buscarEntidadePorId(id));
    }

    @Transactional
    public QuestaoDTO.Response criar(QuestaoDTO.Request request) {
        QuestaoTeorica questao = QuestaoTeorica.builder().build();
        aplicarRequest(questao, request);
        return QuestaoDTO.Response.from(questaoTeoricaRepository.save(questao));
    }

    @Transactional
    public QuestaoDTO.Response atualizar(UUID id, QuestaoDTO.Request request) {
        QuestaoTeorica questao = buscarEntidadePorId(id);
        aplicarRequest(questao, request);
        return QuestaoDTO.Response.from(questaoTeoricaRepository.save(questao));
    }

    @Transactional
    public QuestaoDTO.Response publicar(UUID id) {
        QuestaoTeorica questao = buscarEntidadePorId(id);
        questao.setStatus(QuestaoTeorica.Status.PUBLICADA);
        return QuestaoDTO.Response.from(questaoTeoricaRepository.save(questao));
    }

    @Transactional
    public QuestaoDTO.Response arquivar(UUID id) {
        QuestaoTeorica questao = buscarEntidadePorId(id);
        questao.setStatus(QuestaoTeorica.Status.ARQUIVADA);
        return QuestaoDTO.Response.from(questaoTeoricaRepository.save(questao));
    }

    @Transactional
    public QuestaoImportDTO.ImportResponse importarLote(QuestaoImportDTO.ImportRequest request) {
        QuestaoImportDTO.ImportResponse response = new QuestaoImportDTO.ImportResponse();
        response.setDryRun(request.isDryRun());
        response.setTotalRecebidas(request.getQuestoes().size());

        for (QuestaoImportDTO.QuestaoRequest item : request.getQuestoes()) {
            QuestaoImportDTO.ItemResultado itemResultado = new QuestaoImportDTO.ItemResultado();
            itemResultado.setOrigem(item.getOrigem());
            itemResultado.setOrigemQuestaoId(item.getOrigemQuestaoId());
            itemResultado.setEnunciado(item.getEnunciado());

            try {
                validarAlternativasImportacao(item.getAlternativas());

                Optional<QuestaoTeorica> existente = buscarExistenteImportacao(item);
                boolean atualiza = existente.isPresent() && request.isAtualizarExistentes();

                if (existente.isPresent() && !atualiza) {
                    itemResultado.setQuestaoId(existente.get().getId());
                    itemResultado.setAcao("IGNORADA");
                    itemResultado.setDetalhe("Questao duplicada por origem/fingerprint.");
                    response.setIgnoradas(response.getIgnoradas() + 1);
                    response.getItens().add(itemResultado);
                    continue;
                }

                QuestaoTeorica questao = existente.orElseGet(() -> QuestaoTeorica.builder().build());
                aplicarImportacao(questao, item);

                if (!request.isDryRun()) {
                    questao = questaoTeoricaRepository.save(questao);
                }

                itemResultado.setQuestaoId(questao.getId());
                itemResultado.setAcao(existente.isPresent() ? "ATUALIZADA" : "CRIADA");
                itemResultado.setDetalhe(request.isDryRun()
                        ? "Validada em dry-run."
                        : "Importada com sucesso como rascunho.");

                if (existente.isPresent()) {
                    response.setAtualizadas(response.getAtualizadas() + 1);
                } else {
                    response.setCriadas(response.getCriadas() + 1);
                }
            } catch (Exception exception) {
                itemResultado.setAcao("ERRO");
                itemResultado.setDetalhe(exception.getMessage());
                response.setErros(response.getErros() + 1);
            }

            response.getItens().add(itemResultado);
        }

        return response;
    }

    @Transactional
    public void excluir(UUID id) {
        if (!questaoTeoricaRepository.existsById(id)) {
            throw new IllegalArgumentException("Questao nao encontrada.");
        }
        questaoTeoricaRepository.deleteById(id);
    }

    public QuestaoTeorica buscarEntidadePorId(UUID id) {
        return questaoTeoricaRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Questao nao encontrada."));
    }

    @Transactional
    public QuestaoAlunoDTO.ResponderResponse responder(String email, UUID questaoId, QuestaoAlunoDTO.ResponderRequest request) {
        Usuario usuario = usuarioLookupService.buscarPorEmail(email);
        QuestaoTeorica questao = buscarQuestaoPublicada(questaoId);

        QuestaoAlternativa alternativaSelecionada = questao.getAlternativas().stream()
                .filter(item -> item.getId().equals(request.getAlternativaId()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Alternativa nao encontrada para essa questao."));

        QuestaoAlternativa alternativaCorreta = questao.getAlternativas().stream()
                .filter(QuestaoAlternativa::isCorreta)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Questao sem alternativa correta cadastrada."));

        boolean correta = alternativaSelecionada.getId().equals(alternativaCorreta.getId());

        respostaQuestaoAlunoRepository.save(RespostaQuestaoAluno.builder()
                .usuario(usuario)
                .questao(questao)
                .alternativa(alternativaSelecionada)
                .correta(correta)
                .build());

        QuestaoAlunoDTO.ResponderResponse response = new QuestaoAlunoDTO.ResponderResponse();
        response.setQuestaoId(questao.getId());
        response.setCorreta(correta);
        response.setAlternativaSelecionadaId(alternativaSelecionada.getId());
        response.setAlternativaCorretaId(alternativaCorreta.getId());
        response.setExplicacaoCurta(questao.getExplicacaoCurta());
        response.setExplicacaoDetalhada(questao.getExplicacaoDetalhada());
        response.setVideoUrl(questao.getVideoUrl());
        response.setAlternativaCorretaTexto(alternativaCorreta.getTexto());
        response.setAlternativaCorretaLabel(formatAlternativaLabel(alternativaCorreta.getOrdem()));
        return response;
    }

    private boolean correspondeBusca(QuestaoTeorica questao, String termo) {
        return questao.getEnunciado().toLowerCase().contains(termo)
                || questao.getExplicacaoCurta().toLowerCase().contains(termo)
                || (questao.getExplicacaoDetalhada() != null && questao.getExplicacaoDetalhada().toLowerCase().contains(termo));
    }

    private void aplicarRequest(QuestaoTeorica questao, QuestaoDTO.Request request) {
        validarAlternativas(request.getAlternativas());
        QuestaoTeorica.Modalidade modalidade = normalizarModalidade(request.getModalidade());
        validarTemaDaModalidade(modalidade, request.getTema());

        questao.setEnunciado(request.getEnunciado().trim());
        questao.setImagemUrl(normalizarTexto(request.getImagemUrl()));
        questao.setModalidade(modalidade);
        questao.setTema(request.getTema());
        questao.setDificuldade(request.getDificuldade() == null ? QuestaoTeorica.Dificuldade.MEDIA : request.getDificuldade());
        questao.setStatus(request.getStatus() == null ? QuestaoTeorica.Status.RASCUNHO : request.getStatus());
        questao.setExplicacaoCurta(request.getExplicacaoCurta().trim());
        questao.setExplicacaoDetalhada(normalizarTexto(request.getExplicacaoDetalhada()));
        questao.setVideoUrl(normalizarTexto(request.getVideoUrl()));
        questao.setOrdemExibicao(request.getOrdemExibicao() == null ? 0 : request.getOrdemExibicao());
        questao.substituirAlternativas(montarAlternativas(request.getAlternativas()));
    }

    private void aplicarImportacao(QuestaoTeorica questao, QuestaoImportDTO.QuestaoRequest request) {
        QuestaoTeorica.Modalidade modalidade = normalizarModalidade(request.getModalidade());
        validarTemaDaModalidade(modalidade, request.getTema());

        questao.setEnunciado(request.getEnunciado().trim());
        questao.setImagemUrl(normalizarTexto(request.getImagemUrl()));
        questao.setModalidade(modalidade);
        questao.setTema(request.getTema());
        questao.setDificuldade(request.getDificuldade() == null ? QuestaoTeorica.Dificuldade.MEDIA : request.getDificuldade());
        questao.setStatus(request.getStatus() == null ? QuestaoTeorica.Status.RASCUNHO : request.getStatus());
        questao.setExplicacaoCurta(request.getExplicacaoCurta().trim());
        questao.setExplicacaoDetalhada(normalizarTexto(request.getExplicacaoDetalhada()));
        questao.setVideoUrl(normalizarTexto(request.getVideoUrl()));
        questao.setOrdemExibicao(request.getOrdemExibicao() == null ? 0 : request.getOrdemExibicao());
        questao.setOrigem(normalizarTexto(request.getOrigem()));
        questao.setOrigemQuestaoId(normalizarTexto(request.getOrigemQuestaoId()));
        questao.setFingerprint(normalizarTexto(request.getFingerprint()));
        questao.substituirAlternativas(montarAlternativasImportacao(request.getAlternativas()));
    }

    private List<QuestaoAlternativa> montarAlternativas(List<QuestaoDTO.AlternativaRequest> alternativas) {
        return alternativas.stream()
                .map(item -> QuestaoAlternativa.builder()
                        .texto(normalizarTexto(item.getTexto()))
                        .imagemUrl(normalizarTexto(item.getImagemUrl()))
                        .ordem(item.getOrdem())
                        .correta(item.isCorreta())
                        .build())
                .toList();
    }

    private List<QuestaoAlternativa> montarAlternativasImportacao(List<QuestaoImportDTO.AlternativaRequest> alternativas) {
        return alternativas.stream()
                .map(item -> QuestaoAlternativa.builder()
                        .texto(normalizarTexto(item.getTexto()))
                        .imagemUrl(normalizarTexto(item.getImagemUrl()))
                        .ordem(item.getOrdem())
                        .correta(item.isCorreta())
                        .build())
                .toList();
    }

    private void validarAlternativas(List<QuestaoDTO.AlternativaRequest> alternativas) {
        long corretas = alternativas.stream().filter(QuestaoDTO.AlternativaRequest::isCorreta).count();
        if (corretas != 1) {
            throw new IllegalArgumentException("Selecione exatamente uma alternativa correta.");
        }

        for (int i = 0; i < alternativas.size(); i++) {
            QuestaoDTO.AlternativaRequest alternativa = alternativas.get(i);
            if (alternativa.getOrdem() == null) {
                alternativa.setOrdem(i);
            }

            if (normalizarTexto(alternativa.getTexto()) == null && normalizarTexto(alternativa.getImagemUrl()) == null) {
                throw new IllegalArgumentException("Cada alternativa precisa ter texto, imagem ou os dois.");
            }
        }
    }

    private void validarAlternativasImportacao(List<QuestaoImportDTO.AlternativaRequest> alternativas) {
        long corretas = alternativas.stream().filter(QuestaoImportDTO.AlternativaRequest::isCorreta).count();
        if (corretas != 1) {
            throw new IllegalArgumentException("Selecione exatamente uma alternativa correta.");
        }

        for (int i = 0; i < alternativas.size(); i++) {
            QuestaoImportDTO.AlternativaRequest alternativa = alternativas.get(i);
            if (alternativa.getOrdem() == null) {
                alternativa.setOrdem(i);
            }

            if (normalizarTexto(alternativa.getTexto()) == null && normalizarTexto(alternativa.getImagemUrl()) == null) {
                throw new IllegalArgumentException("Cada alternativa precisa ter texto, imagem ou os dois.");
            }
        }
    }

    private Optional<QuestaoTeorica> buscarExistenteImportacao(QuestaoImportDTO.QuestaoRequest request) {
        String origem = normalizarTexto(request.getOrigem());
        String origemQuestaoId = normalizarTexto(request.getOrigemQuestaoId());
        String fingerprint = normalizarTexto(request.getFingerprint());

        if (origem != null && origemQuestaoId != null) {
            Optional<QuestaoTeorica> porOrigem = questaoTeoricaRepository.findByOrigemAndOrigemQuestaoId(origem, origemQuestaoId);
            if (porOrigem.isPresent()) {
                return porOrigem;
            }
        }

        if (fingerprint != null) {
            return questaoTeoricaRepository.findByFingerprint(fingerprint);
        }

        return Optional.empty();
    }

    private String normalizarTexto(String valor) {
        if (valor == null) {
            return null;
        }

        String texto = valor.trim();
        return texto.isBlank() ? null : texto;
    }

    private String formatAlternativaLabel(Integer ordem) {
        int indice = ordem == null ? 0 : ordem;
        return String.valueOf((char) ('A' + indice));
    }

    private QuestaoTeorica.Modalidade normalizarModalidade(QuestaoTeorica.Modalidade modalidade) {
        return modalidade == null ? QuestaoTeorica.Modalidade.TEORICO : modalidade;
    }

    private void validarTemaDaModalidade(QuestaoTeorica.Modalidade modalidade, QuestaoTeorica.Tema tema) {
        boolean temaTeorico = Stream.of(
                QuestaoTeorica.Tema.PLACAS,
                QuestaoTeorica.Tema.LEGISLACAO,
                QuestaoTeorica.Tema.DIRECAO_DEFENSIVA,
                QuestaoTeorica.Tema.PRIMEIROS_SOCORROS,
                QuestaoTeorica.Tema.MECANICA_BASICA,
                QuestaoTeorica.Tema.MEIO_AMBIENTE_CIDADANIA
        ).anyMatch(item -> item == tema);

        if (modalidade == QuestaoTeorica.Modalidade.TEORICO && !temaTeorico) {
            throw new IllegalArgumentException("Tema invalido para questao teorica.");
        }

        if (modalidade == QuestaoTeorica.Modalidade.PRATICO && temaTeorico) {
            throw new IllegalArgumentException("Tema invalido para questao pratica.");
        }
    }

    private QuestaoTeorica buscarQuestaoPublicada(UUID id) {
        QuestaoTeorica questao = buscarEntidadePorId(id);
        if (questao.getStatus() != QuestaoTeorica.Status.PUBLICADA) {
            throw new IllegalArgumentException("Essa questao nao esta disponivel no momento.");
        }
        return questao;
    }
}
