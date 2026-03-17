package com.edupercurso.dto;

import com.edupercurso.entity.Percurso;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

public class PercursoDTO {

    @Data
    public static class Request {
        @NotBlank
        private String titulo;
        private String descricao;
        @NotBlank
        private String videoUrl;
        private Integer duracaoSegundos;
        private UUID categoriaId;
        private UUID localProvaId;
        private Percurso.TipoConteudo tipoConteudo = Percurso.TipoConteudo.PERCURSO_REAL;
        private String resumo;
        private String thumbnailUrl;
        private Integer ordemExibicao = 0;
        private boolean destaque;
        private boolean ativo = true;
    }

    @Data
    public static class Response {
        private UUID id;
        private String titulo;
        private String descricao;
        private String videoUrl;
        private Integer duracaoSegundos;
        private boolean ativo;
        private UUID categoriaId;
        private String categoriaNome;
        private UUID localProvaId;
        private String localProvaNome;
        private String localProvaSlug;
        private String tipoConteudo;
        private String resumo;
        private String thumbnailUrl;
        private Integer ordemExibicao;
        private boolean destaque;
        private LocalDateTime criadoEm;

        public static Response from(Percurso percurso) {
            Response response = new Response();
            response.id = percurso.getId();
            response.titulo = percurso.getTitulo();
            response.descricao = percurso.getDescricao();
            response.videoUrl = percurso.getVideoUrl();
            response.duracaoSegundos = percurso.getDuracaoSegundos();
            response.ativo = percurso.isAtivo();
            response.tipoConteudo = percurso.getTipoConteudo().name();
            response.resumo = percurso.getResumo();
            response.thumbnailUrl = percurso.getThumbnailUrl();
            response.ordemExibicao = percurso.getOrdemExibicao();
            response.destaque = percurso.isDestaque();
            response.criadoEm = percurso.getCriadoEm();

            if (percurso.getCategoria() != null) {
                response.categoriaId = percurso.getCategoria().getId();
                response.categoriaNome = percurso.getCategoria().getNome();
            }
            if (percurso.getLocalProva() != null) {
                response.localProvaId = percurso.getLocalProva().getId();
                response.localProvaNome = percurso.getLocalProva().getNome();
                response.localProvaSlug = percurso.getLocalProva().getSlug();
            }

            return response;
        }
    }
}
