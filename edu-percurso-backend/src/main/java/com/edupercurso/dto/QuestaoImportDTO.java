package com.edupercurso.dto;

import com.edupercurso.entity.QuestaoTeorica;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class QuestaoImportDTO {

    @Data
    public static class AlternativaRequest {
        private String texto;
        private String imagemUrl;
        private Integer ordem;
        private boolean correta;
    }

    @Data
    public static class QuestaoRequest {
        @NotBlank
        private String enunciado;

        private String imagemUrl;

        @NotNull
        private QuestaoTeorica.Tema tema;

        private QuestaoTeorica.Modalidade modalidade = QuestaoTeorica.Modalidade.TEORICO;

        @NotNull
        private QuestaoTeorica.Dificuldade dificuldade = QuestaoTeorica.Dificuldade.MEDIA;

        @NotNull
        private QuestaoTeorica.Status status = QuestaoTeorica.Status.RASCUNHO;

        @NotBlank
        private String explicacaoCurta;

        private String explicacaoDetalhada;
        private String videoUrl;
        private Integer ordemExibicao = 0;

        @NotBlank
        private String origem;

        private String origemQuestaoId;
        private String fingerprint;

        @Valid
        @NotEmpty
        @Size(min = 4, max = 4)
        private List<AlternativaRequest> alternativas;
    }

    @Data
    public static class ImportRequest {
        @Valid
        @NotEmpty
        private List<QuestaoRequest> questoes;

        private boolean dryRun = false;
        private boolean atualizarExistentes = false;
    }

    @Data
    public static class ItemResultado {
        private String origem;
        private String origemQuestaoId;
        private String enunciado;
        private UUID questaoId;
        private String acao;
        private String detalhe;
    }

    @Data
    public static class ImportResponse {
        private int totalRecebidas;
        private int criadas;
        private int atualizadas;
        private int ignoradas;
        private int erros;
        private boolean dryRun;
        private List<ItemResultado> itens = new ArrayList<>();
    }
}
