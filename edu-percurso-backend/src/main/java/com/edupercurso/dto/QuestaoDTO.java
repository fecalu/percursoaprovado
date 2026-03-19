package com.edupercurso.dto;

import com.edupercurso.entity.QuestaoAlternativa;
import com.edupercurso.entity.QuestaoTeorica;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public class QuestaoDTO {

    @Data
    public static class AlternativaRequest {
        private String texto;
        private String imagemUrl;
        private Integer ordem;
        private boolean correta;
    }

    @Data
    public static class Request {
        @NotBlank
        private String enunciado;

        private String imagemUrl;

        @NotNull
        private QuestaoTeorica.Tema tema;

        @NotNull
        private QuestaoTeorica.Dificuldade dificuldade = QuestaoTeorica.Dificuldade.MEDIA;

        @NotNull
        private QuestaoTeorica.Status status = QuestaoTeorica.Status.RASCUNHO;

        @NotBlank
        private String explicacaoCurta;

        private String explicacaoDetalhada;
        private String videoUrl;
        private Integer ordemExibicao = 0;

        @Valid
        @NotEmpty
        @Size(min = 4, max = 4)
        private List<AlternativaRequest> alternativas;
    }

    @Data
    public static class AlternativaResponse {
        private UUID id;
        private String texto;
        private String imagemUrl;
        private Integer ordem;
        private boolean correta;

        public static AlternativaResponse from(QuestaoAlternativa alternativa) {
            AlternativaResponse response = new AlternativaResponse();
            response.id = alternativa.getId();
            response.texto = alternativa.getTexto();
            response.imagemUrl = alternativa.getImagemUrl();
            response.ordem = alternativa.getOrdem();
            response.correta = alternativa.isCorreta();
            return response;
        }
    }

    @Data
    public static class Response {
        private UUID id;
        private String enunciado;
        private String imagemUrl;
        private String tema;
        private String dificuldade;
        private String status;
        private String explicacaoCurta;
        private String explicacaoDetalhada;
        private String videoUrl;
        private Integer ordemExibicao;
        private LocalDateTime criadoEm;
        private List<AlternativaResponse> alternativas;

        public static Response from(QuestaoTeorica questao) {
            Response response = new Response();
            response.id = questao.getId();
            response.enunciado = questao.getEnunciado();
            response.imagemUrl = questao.getImagemUrl();
            response.tema = questao.getTema().name();
            response.dificuldade = questao.getDificuldade().name();
            response.status = questao.getStatus().name();
            response.explicacaoCurta = questao.getExplicacaoCurta();
            response.explicacaoDetalhada = questao.getExplicacaoDetalhada();
            response.videoUrl = questao.getVideoUrl();
            response.ordemExibicao = questao.getOrdemExibicao();
            response.criadoEm = questao.getCriadoEm();
            response.alternativas = questao.getAlternativas().stream()
                    .map(AlternativaResponse::from)
                    .toList();
            return response;
        }
    }
}
