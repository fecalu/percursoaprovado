package com.edupercurso.dto;

import com.edupercurso.entity.DuvidaPercurso;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

public class DuvidaPercursoDTO {

    @Data
    public static class CreateRequest {
        @NotNull
        @Min(0)
        private Integer timestampSegundos;

        @NotBlank
        private String descricao;
    }

    @Data
    public static class AdminUpdateRequest {
        @NotNull
        @Min(0)
        private Integer timestampSegundos;

        @NotBlank
        private String descricao;

        @NotNull
        private DuvidaPercurso.Status status;

        private String respostaOficial;

        @Max(30)
        @Min(0)
        private Integer janelaRelacionadaSegundos;
    }

    @Data
    public static class Response {
        private UUID id;
        private UUID percursoId;
        private String percursoTitulo;
        private UUID localProvaId;
        private String localProvaNome;
        private UUID usuarioId;
        private String autorNome;
        private String autorNomeAbreviado;
        private Integer timestampSegundos;
        private String titulo;
        private String descricao;
        private String status;
        private String respostaOficial;
        private String respondidaPorNome;
        private Long quantidadeApoios;
        private boolean apoiadaPeloUsuario;
        private LocalDateTime publicadaEm;
        private LocalDateTime respostaCriadaEm;
        private LocalDateTime criadaEm;
        private LocalDateTime atualizadaEm;
        private Integer janelaRelacionadaSegundos;

        public static Response from(
                DuvidaPercurso duvida,
                long quantidadeApoios,
                boolean apoiadaPeloUsuario,
                Integer janelaRelacionadaSegundos
        ) {
            Response response = new Response();
            response.id = duvida.getId();
            response.percursoId = duvida.getPercurso().getId();
            response.percursoTitulo = duvida.getPercurso().getTitulo();
            response.localProvaId = duvida.getPercurso().getLocalProva() == null ? null : duvida.getPercurso().getLocalProva().getId();
            response.localProvaNome = duvida.getPercurso().getLocalProva() == null ? null : duvida.getPercurso().getLocalProva().getNome();
            response.usuarioId = duvida.getUsuario().getId();
            response.autorNome = duvida.getUsuario().getNome();
            response.autorNomeAbreviado = abreviarNome(duvida.getUsuario().getNome());
            response.timestampSegundos = duvida.getTimestampSegundos();
            response.titulo = duvida.getTitulo();
            response.descricao = duvida.getDescricao();
            response.status = duvida.getStatus().name();
            response.respostaOficial = duvida.getRespostaOficial();
            response.respondidaPorNome = duvida.getRespondidaPor() == null ? null : duvida.getRespondidaPor().getNome();
            response.quantidadeApoios = quantidadeApoios;
            response.apoiadaPeloUsuario = apoiadaPeloUsuario;
            response.publicadaEm = duvida.getPublicadaEm();
            response.respostaCriadaEm = duvida.getRespostaCriadaEm();
            response.criadaEm = duvida.getCriadaEm();
            response.atualizadaEm = duvida.getAtualizadaEm();
            response.janelaRelacionadaSegundos = janelaRelacionadaSegundos != null
                    ? janelaRelacionadaSegundos
                    : duvida.getJanelaRelacionadaSegundos();
            return response;
        }

        private static String abreviarNome(String nome) {
            if (nome == null || nome.isBlank()) {
                return "Aluno";
            }

            String[] partes = nome.trim().split("\\s+");
            if (partes.length == 1) {
                return partes[0];
            }

            String primeiraParte = partes[0];
            String ultimaInicial = partes[partes.length - 1].substring(0, 1).toUpperCase();
            return primeiraParte + " " + ultimaInicial + ".";
        }
    }
}
