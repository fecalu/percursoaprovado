package com.edupercurso.dto;

import com.edupercurso.entity.GrupoAcesso;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.UUID;

public class GrupoAcessoDTO {

    @Data
    public static class Request {
        @NotBlank
        private String codigo;

        @NotBlank
        private String nome;

        private String descricao;
        private Integer ordemExibicao;
        private boolean ativo = true;
    }

    @Data
    public static class Response {
        private UUID id;
        private String codigo;
        private String nome;
        private String descricao;
        private Integer ordemExibicao;
        private boolean ativo;

        public static Response from(GrupoAcesso grupoAcesso) {
            Response response = new Response();
            response.id = grupoAcesso.getId();
            response.codigo = grupoAcesso.getCodigo();
            response.nome = grupoAcesso.getNome();
            response.descricao = grupoAcesso.getDescricao();
            response.ordemExibicao = grupoAcesso.getOrdemExibicao();
            response.ativo = grupoAcesso.isAtivo();
            return response;
        }
    }
}
