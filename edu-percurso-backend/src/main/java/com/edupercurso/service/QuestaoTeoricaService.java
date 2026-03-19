package com.edupercurso.service;

import com.edupercurso.dto.QuestaoAlunoDTO;
import com.edupercurso.dto.QuestaoDTO;
import com.edupercurso.entity.QuestaoAlternativa;
import com.edupercurso.entity.QuestaoTeorica;
import com.edupercurso.entity.RespostaQuestaoAluno;
import com.edupercurso.entity.Usuario;
import com.edupercurso.repository.QuestaoTeoricaRepository;
import com.edupercurso.repository.RespostaQuestaoAlunoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class QuestaoTeoricaService {

    private final QuestaoTeoricaRepository questaoTeoricaRepository;
    private final RespostaQuestaoAlunoRepository respostaQuestaoAlunoRepository;
    private final UsuarioLookupService usuarioLookupService;

    public List<QuestaoDTO.Response> listarAdmin(String busca,
                                                 QuestaoTeorica.Tema tema,
                                                 QuestaoTeorica.Status status) {
        String termo = busca == null ? "" : busca.trim().toLowerCase();

        return questaoTeoricaRepository.findAll().stream()
                .filter(questao -> termo.isBlank() || correspondeBusca(questao, termo))
                .filter(questao -> tema == null || questao.getTema() == tema)
                .filter(questao -> status == null || questao.getStatus() == status)
                .sorted(Comparator
                        .comparing(QuestaoTeorica::getOrdemExibicao, Comparator.nullsLast(Integer::compareTo))
                        .thenComparing(QuestaoTeorica::getCriadoEm, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(QuestaoDTO.Response::from)
                .toList();
    }

    public List<QuestaoAlunoDTO.TemaResumoResponse> listarTemasDisponiveis() {
        Map<QuestaoTeorica.Tema, Long> totais = questaoTeoricaRepository.findByStatus(QuestaoTeorica.Status.PUBLICADA).stream()
                .collect(Collectors.groupingBy(QuestaoTeorica::getTema, Collectors.counting()));

        return totais.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> QuestaoAlunoDTO.TemaResumoResponse.from(entry.getKey(), entry.getValue()))
                .toList();
    }

    public List<QuestaoAlunoDTO.QuestaoTreinoResponse> listarTreino(QuestaoTeorica.Tema tema) {
        List<QuestaoTeorica> questoes = tema == null
                ? questaoTeoricaRepository.findByStatus(QuestaoTeorica.Status.PUBLICADA)
                : questaoTeoricaRepository.findByStatusAndTema(QuestaoTeorica.Status.PUBLICADA, tema);

        return questoes.stream()
                .sorted(Comparator
                        .comparing(QuestaoTeorica::getOrdemExibicao, Comparator.nullsLast(Integer::compareTo))
                        .thenComparing(QuestaoTeorica::getCriadoEm, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(QuestaoAlunoDTO.QuestaoTreinoResponse::from)
                .toList();
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

        questao.setEnunciado(request.getEnunciado().trim());
        questao.setImagemUrl(normalizarTexto(request.getImagemUrl()));
        questao.setTema(request.getTema());
        questao.setDificuldade(request.getDificuldade() == null ? QuestaoTeorica.Dificuldade.MEDIA : request.getDificuldade());
        questao.setStatus(request.getStatus() == null ? QuestaoTeorica.Status.RASCUNHO : request.getStatus());
        questao.setExplicacaoCurta(request.getExplicacaoCurta().trim());
        questao.setExplicacaoDetalhada(normalizarTexto(request.getExplicacaoDetalhada()));
        questao.setVideoUrl(normalizarTexto(request.getVideoUrl()));
        questao.setOrdemExibicao(request.getOrdemExibicao() == null ? 0 : request.getOrdemExibicao());
        questao.substituirAlternativas(montarAlternativas(request.getAlternativas()));
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

    private QuestaoTeorica buscarQuestaoPublicada(UUID id) {
        QuestaoTeorica questao = buscarEntidadePorId(id);
        if (questao.getStatus() != QuestaoTeorica.Status.PUBLICADA) {
            throw new IllegalArgumentException("Essa questao nao esta disponivel no momento.");
        }
        return questao;
    }
}
