package com.edupercurso.dto;

import com.edupercurso.entity.Pedido;
import com.edupercurso.entity.SolicitacaoCancelamento;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

public class SolicitacaoCancelamentoDTO {

    @Data
    public static class CreateRequest {
        @NotBlank(message = "Escolha um motivo para a solicitacao.")
        @Size(max = 120, message = "O motivo deve ter ate 120 caracteres.")
        private String motivo;

        @Size(max = 1500, message = "A observacao deve ter ate 1500 caracteres.")
        private String observacaoAluno;
    }

    @Data
    public static class ProcessRequest {
        @Size(max = 1500, message = "A observacao deve ter ate 1500 caracteres.")
        private String observacaoAdmin;
    }

    @Data
    public static class Response {
        private UUID id;
        private UUID pedidoId;
        private String pedidoReferencia;
        private UUID usuarioId;
        private String usuarioNome;
        private String usuarioEmail;
        private UUID localProvaId;
        private String localProvaNome;
        private String localProvaSlug;
        private UUID planoId;
        private String planoNome;
        private Integer valorCentavos;
        private String paymentId;
        private String paymentStatus;
        private LocalDateTime pagoEm;
        private String motivo;
        private String observacaoAluno;
        private String status;
        private String observacaoAdmin;
        private String processadoPorEmail;
        private LocalDateTime criadoEm;
        private LocalDateTime processadoEm;
        private String reembolsadoPorEmail;
        private LocalDateTime reembolsadoEm;

        public static Response from(SolicitacaoCancelamento solicitacao) {
            Pedido pedido = solicitacao.getPedido();

            Response response = new Response();
            response.id = solicitacao.getId();
            response.pedidoId = pedido.getId();
            response.pedidoReferencia = pedido.getReferencia();
            response.usuarioId = solicitacao.getUsuario().getId();
            response.usuarioNome = solicitacao.getUsuario().getNome();
            response.usuarioEmail = solicitacao.getUsuario().getEmail();
            response.localProvaId = pedido.getLocalProva().getId();
            response.localProvaNome = pedido.getLocalProva().getNome();
            response.localProvaSlug = pedido.getLocalProva().getSlug();
            response.planoId = pedido.getPlano().getId();
            response.planoNome = pedido.getPlano().getNome();
            response.valorCentavos = pedido.getValorCentavos();
            response.paymentId = pedido.getPaymentId();
            response.paymentStatus = pedido.getPaymentStatus();
            response.pagoEm = pedido.getPagoEm();
            response.motivo = solicitacao.getMotivo();
            response.observacaoAluno = solicitacao.getObservacaoAluno();
            response.status = solicitacao.getStatus().name();
            response.observacaoAdmin = solicitacao.getObservacaoAdmin();
            response.processadoPorEmail = solicitacao.getProcessadoPorEmail();
            response.criadoEm = solicitacao.getCriadoEm();
            response.processadoEm = solicitacao.getProcessadoEm();
            response.reembolsadoPorEmail = solicitacao.getReembolsadoPorEmail();
            response.reembolsadoEm = solicitacao.getReembolsadoEm();
            return response;
        }
    }
}
