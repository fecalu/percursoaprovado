package com.edupercurso.dto;

import com.edupercurso.entity.Trilha;
import com.edupercurso.entity.TrilhaEtapa;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.UUID;

public class TrilhaDTO {

    @Data
    public static class EtapaRequest {
        private UUID id;

        @NotNull
        private UUID grupoAcessoId;

        @NotBlank
        private String titulo;

        private String resumo;
        private Integer ordemExibicao;
        private boolean ativo = true;
    }

    @Data
    public static class Request {
        @NotBlank
        private String codigo;

        @NotBlank
        private String nome;

        private String descricao;
        private Integer ordemExibicao;
        private boolean ativo = true;

        @Valid
        private List<EtapaRequest> etapas;
    }

    @Data
    public static class EtapaResponse {
        private UUID id;
        private UUID grupoAcessoId;
        private String grupoAcessoCodigo;
        private String grupoAcessoNome;
        private String titulo;
        private String resumo;
        private Integer ordemExibicao;
        private boolean ativo;

        public static EtapaResponse from(TrilhaEtapa etapa) {
            EtapaResponse response = new EtapaResponse();
            response.id = etapa.getId();
            response.grupoAcessoId = etapa.getGrupoAcesso().getId();
            response.grupoAcessoCodigo = etapa.getGrupoAcesso().getCodigo();
            response.grupoAcessoNome = etapa.getGrupoAcesso().getNome();
            response.titulo = etapa.getTitulo();
            response.resumo = etapa.getResumo();
            response.ordemExibicao = etapa.getOrdemExibicao();
            response.ativo = etapa.isAtivo();
            return response;
        }
    }

    @Data
    public static class Response {
        private UUID id;
        private String codigo;
        private String nome;
        private String descricao;
        private Integer ordemExibicao;
        private boolean ativo;
        private List<EtapaResponse> etapas;

        public static Response from(Trilha trilha) {
            Response response = new Response();
            response.id = trilha.getId();
            response.codigo = trilha.getCodigo();
            response.nome = trilha.getNome();
            response.descricao = trilha.getDescricao();
            response.ordemExibicao = trilha.getOrdemExibicao();
            response.ativo = trilha.isAtivo();
            response.etapas = trilha.getEtapas().stream()
                    .map(EtapaResponse::from)
                    .toList();
            return response;
        }
    }
}
