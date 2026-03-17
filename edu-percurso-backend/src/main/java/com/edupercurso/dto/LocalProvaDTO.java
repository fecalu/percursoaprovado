package com.edupercurso.dto;

import com.edupercurso.entity.LocalProva;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

public class LocalProvaDTO {

    @Data
    public static class Request {
        @NotBlank
        private String nome;
        private String slug;
        private String descricao;
        private String cidade;
        private boolean ativo = true;
        private String statusComercial = "RASCUNHO";
        private String mensagemPublica;
        private Integer ordemExibicao = 0;
    }

    @Data
    public static class Response {
        private UUID id;
        private String nome;
        private String slug;
        private String descricao;
        private String cidade;
        private boolean ativo;
        private String statusComercial;
        private String mensagemPublica;
        private Integer ordemExibicao;
        private LocalDateTime criadoEm;

        public static Response from(LocalProva localProva) {
            Response response = new Response();
            response.id = localProva.getId();
            response.nome = localProva.getNome();
            response.slug = localProva.getSlug();
            response.descricao = localProva.getDescricao();
            response.cidade = localProva.getCidade();
            response.ativo = localProva.isAtivo();
            response.statusComercial = localProva.getStatusComercial().name();
            response.mensagemPublica = localProva.getMensagemPublica();
            response.ordemExibicao = localProva.getOrdemExibicao();
            response.criadoEm = localProva.getCriadoEm();
            return response;
        }
    }
}
