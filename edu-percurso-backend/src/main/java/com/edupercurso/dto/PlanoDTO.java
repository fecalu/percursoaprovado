package com.edupercurso.dto;

import com.edupercurso.entity.Plano;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

public class PlanoDTO {

    @Data
    public static class Request {
        @NotNull
        private UUID localProvaId;
        @NotBlank
        private String nome;
        @NotNull
        private Integer duracaoDias;
        @NotNull
        private Integer precoCentavos;
        private boolean ativo = true;
    }

    @Data
    public static class Response {
        private UUID id;
        private UUID localProvaId;
        private String localProvaNome;
        private String localProvaSlug;
        private String nome;
        private Integer duracaoDias;
        private Integer precoCentavos;
        private boolean ativo;
        private LocalDateTime criadoEm;

        public static Response from(Plano plano) {
            Response response = new Response();
            response.id = plano.getId();
            response.localProvaId = plano.getLocalProva().getId();
            response.localProvaNome = plano.getLocalProva().getNome();
            response.localProvaSlug = plano.getLocalProva().getSlug();
            response.nome = plano.getNome();
            response.duracaoDias = plano.getDuracaoDias();
            response.precoCentavos = plano.getPrecoCentavos();
            response.ativo = plano.isAtivo();
            response.criadoEm = plano.getCriadoEm();
            return response;
        }
    }
}
