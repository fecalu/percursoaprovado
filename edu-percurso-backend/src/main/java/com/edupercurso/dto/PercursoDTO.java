package com.edupercurso.dto;

import com.edupercurso.entity.Percurso;
import com.edupercurso.entity.PontoAtencaoPercurso;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public class PercursoDTO {

    @Data
    public static class Request {
        @NotBlank
        private String titulo;
        private String descricao;
        private String videoUrl;
        private Percurso.VideoProvider videoProvider = Percurso.VideoProvider.YOUTUBE;
        private String videoAssetId;
        private Integer duracaoSegundos;
        private UUID categoriaId;
        private UUID localProvaId;
        private Percurso.TipoConteudo tipoConteudo = Percurso.TipoConteudo.PERCURSO_REAL;
        private String resumo;
        private String thumbnailUrl;
        private Integer ordemExibicao = 0;
        private boolean destaque;
        private boolean ativo = true;
        @Valid
        private List<PontoAtencaoRequest> pontosAtencao;
    }

    @Data
    public static class PontoAtencaoRequest {
        private UUID id;
        @NotNull
        private Integer timestampSegundos;
        @NotBlank
        private String titulo;
        private String descricaoCurta;
        private String descricaoDetalhada;
        @NotNull
        private PontoAtencaoPercurso.Tipo tipo = PontoAtencaoPercurso.Tipo.DICA_IMPORTANTE;
        private String imagemUrl;
        private String videoUrl;
        @NotNull
        private PontoAtencaoPercurso.ModoExibicao modoExibicao = PontoAtencaoPercurso.ModoExibicao.CLIQUE;
        private Integer ordemExibicao = 0;
        private boolean ativo = true;
    }

    @Data
    public static class PontoAtencaoResponse {
        private UUID id;
        private Integer timestampSegundos;
        private String titulo;
        private String descricaoCurta;
        private String descricaoDetalhada;
        private String tipo;
        private String imagemUrl;
        private String videoUrl;
        private String modoExibicao;
        private Integer ordemExibicao;
        private boolean ativo;

        public static PontoAtencaoResponse from(PontoAtencaoPercurso ponto) {
            PontoAtencaoResponse response = new PontoAtencaoResponse();
            response.id = ponto.getId();
            response.timestampSegundos = ponto.getTimestampSegundos();
            response.titulo = ponto.getTitulo();
            response.descricaoCurta = ponto.getDescricaoCurta();
            response.descricaoDetalhada = ponto.getDescricaoDetalhada();
            response.tipo = ponto.getTipo().name();
            response.imagemUrl = ponto.getImagemUrl();
            response.videoUrl = ponto.getVideoUrl();
            response.modoExibicao = ponto.getModoExibicao().name();
            response.ordemExibicao = ponto.getOrdemExibicao();
            response.ativo = ponto.isAtivo();
            return response;
        }
    }

    @Data
    public static class Response {
        private UUID id;
        private String titulo;
        private String descricao;
        private String videoUrl;
        private String videoProvider;
        private String videoAssetId;
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
        private List<PontoAtencaoResponse> pontosAtencao;

        public static Response from(Percurso percurso) {
            Response response = new Response();
            response.id = percurso.getId();
            response.titulo = percurso.getTitulo();
            response.descricao = percurso.getDescricao();
            response.videoUrl = percurso.getVideoUrl();
            response.videoProvider = percurso.getVideoProvider().name();
            response.videoAssetId = percurso.getVideoAssetId();
            response.duracaoSegundos = percurso.getDuracaoSegundos();
            response.ativo = percurso.isAtivo();
            response.tipoConteudo = percurso.getTipoConteudo().name();
            response.resumo = percurso.getResumo();
            response.thumbnailUrl = percurso.getThumbnailUrl();
            response.ordemExibicao = percurso.getOrdemExibicao();
            response.destaque = percurso.isDestaque();
            response.criadoEm = percurso.getCriadoEm();
            response.pontosAtencao = percurso.getPontosAtencao().stream()
                    .map(PontoAtencaoResponse::from)
                    .toList();

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
