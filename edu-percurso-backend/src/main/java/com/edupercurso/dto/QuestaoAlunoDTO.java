package com.edupercurso.dto;

import com.edupercurso.entity.QuestaoAlternativa;
import com.edupercurso.entity.QuestaoTeorica;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.UUID;

public class QuestaoAlunoDTO {

    @Data
    public static class TemaResumoResponse {
        private String tema;
        private String temaLabel;
        private long totalQuestoes;

        public static TemaResumoResponse from(QuestaoTeorica.Tema tema, long totalQuestoes) {
            TemaResumoResponse response = new TemaResumoResponse();
            response.tema = tema.name();
            response.temaLabel = formatTema(tema);
            response.totalQuestoes = totalQuestoes;
            return response;
        }
    }

    @Data
    public static class AlternativaResponse {
        private UUID id;
        private String texto;
        private String imagemUrl;
        private Integer ordem;

        public static AlternativaResponse from(QuestaoAlternativa alternativa) {
            AlternativaResponse response = new AlternativaResponse();
            response.id = alternativa.getId();
            response.texto = alternativa.getTexto();
            response.imagemUrl = alternativa.getImagemUrl();
            response.ordem = alternativa.getOrdem();
            return response;
        }
    }

    @Data
    public static class QuestaoTreinoResponse {
        private UUID id;
        private String enunciado;
        private String imagemUrl;
        private String tema;
        private String temaLabel;
        private String dificuldade;
        private String dificuldadeLabel;
        private Integer ordemExibicao;
        private String explicacaoCurta;
        private String explicacaoDetalhada;
        private String videoUrl;
        private List<AlternativaResponse> alternativas;

        public static QuestaoTreinoResponse from(QuestaoTeorica questao) {
            QuestaoTreinoResponse response = new QuestaoTreinoResponse();
            response.id = questao.getId();
            response.enunciado = questao.getEnunciado();
            response.imagemUrl = questao.getImagemUrl();
            response.tema = questao.getTema().name();
            response.temaLabel = formatTema(questao.getTema());
            response.dificuldade = questao.getDificuldade().name();
            response.dificuldadeLabel = formatDificuldade(questao.getDificuldade());
            response.ordemExibicao = questao.getOrdemExibicao();
            response.explicacaoCurta = questao.getExplicacaoCurta();
            response.explicacaoDetalhada = questao.getExplicacaoDetalhada();
            response.videoUrl = questao.getVideoUrl();
            response.alternativas = questao.getAlternativas().stream()
                    .map(AlternativaResponse::from)
                    .toList();
            return response;
        }
    }

    @Data
    public static class ResponderRequest {
        @NotNull
        private UUID alternativaId;
    }

    @Data
    public static class ResponderResponse {
        private UUID questaoId;
        private boolean correta;
        private UUID alternativaSelecionadaId;
        private UUID alternativaCorretaId;
        private String explicacaoCurta;
        private String explicacaoDetalhada;
        private String videoUrl;
        private String alternativaCorretaTexto;
        private String alternativaCorretaLabel;
    }

    private static String formatTema(QuestaoTeorica.Tema tema) {
        return switch (tema) {
            case PLACAS -> "Placas";
            case LEGISLACAO -> "Legislacao";
            case DIRECAO_DEFENSIVA -> "Direcao defensiva";
            case PRIMEIROS_SOCORROS -> "Primeiros socorros";
            case MECANICA_BASICA -> "Mecanica basica";
            case MEIO_AMBIENTE_CIDADANIA -> "Meio ambiente e cidadania";
            case BALIZA -> "Baliza";
            case CONTROLE_DO_VEICULO -> "Controle do veiculo";
            case LADEIRA -> "Ladeira";
            case PREFERENCIA -> "Preferencia";
            case CONVERSOES -> "Conversoes";
            case ESTACIONAMENTO -> "Estacionamento";
            case FALTAS_ELIMINATORIAS -> "Faltas eliminatorias";
            case CONDUTA_NA_PROVA -> "Conduta na prova";
        };
    }

    private static String formatDificuldade(QuestaoTeorica.Dificuldade dificuldade) {
        return switch (dificuldade) {
            case FACIL -> "Facil";
            case MEDIA -> "Media";
            case DIFICIL -> "Dificil";
        };
    }
}
