package com.edupercurso.dto;

import com.edupercurso.entity.Assinatura;
import com.edupercurso.entity.Pedido;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

public class AssinaturaDTO {

    @Data
    public static class CreateRequest {
        @Email
        @NotBlank
        private String usuarioEmail;

        @NotNull
        private UUID planoId;

        private LocalDateTime inicioEm;
        private String origem;
        private String observacaoInterna;
    }

    @Data
    public static class UpdateRequest {
        private LocalDateTime fimEm;
        private String origem;
        private String observacaoInterna;
    }

    @Data
    public static class ExtendRequest {
        @NotNull
        @Min(1)
        private Integer dias;

        private String observacaoInterna;
    }

    @Data
    public static class CancelRequest {
        private String motivoCancelamento;
    }

    @Data
    public static class Response {
        private UUID id;
        private UUID usuarioId;
        private String usuarioNome;
        private String usuarioEmail;
        private UUID planoId;
        private String planoNome;
        private Integer duracaoDias;
        private UUID localProvaId;
        private String localProvaNome;
        private String localProvaSlug;
        private LocalDateTime inicioEm;
        private LocalDateTime fimEm;
        private Integer diasRestantes;
        private String status;
        private String paymentStatus;
        private String origem;
        private String observacaoInterna;
        private LocalDateTime canceladaEm;
        private String canceladaPorEmail;
        private String motivoCancelamento;
        private UUID pedidoId;
        private String pedidoReferencia;
        private String pedidoStatus;
        private String paymentId;
        private String paymentType;
        private String gatewayPaymentStatus;
        private String gatewayPaymentStatusDetail;
        private LocalDateTime criadoEm;

        public static Response from(Assinatura assinatura, Pedido pedido, int diasRestantes) {
            Response response = new Response();
            response.id = assinatura.getId();
            response.usuarioId = assinatura.getUsuario().getId();
            response.usuarioNome = assinatura.getUsuario().getNome();
            response.usuarioEmail = assinatura.getUsuario().getEmail();
            response.planoId = assinatura.getPlano().getId();
            response.planoNome = assinatura.getPlano().getNome();
            response.duracaoDias = assinatura.getPlano().getDuracaoDias();
            response.localProvaId = assinatura.getLocalProva().getId();
            response.localProvaNome = assinatura.getLocalProva().getNome();
            response.localProvaSlug = assinatura.getLocalProva().getSlug();
            response.inicioEm = assinatura.getInicioEm();
            response.fimEm = assinatura.getFimEm();
            response.diasRestantes = diasRestantes;
            response.status = assinatura.getStatus().name();
            response.paymentStatus = assinatura.getPaymentStatus().name();
            response.origem = assinatura.getOrigem() == null ? null : assinatura.getOrigem().name();
            response.observacaoInterna = assinatura.getObservacaoInterna();
            response.canceladaEm = assinatura.getCanceladaEm();
            response.canceladaPorEmail = assinatura.getCanceladaPorEmail();
            response.motivoCancelamento = assinatura.getMotivoCancelamento();
            if (pedido != null) {
                response.pedidoId = pedido.getId();
                response.pedidoReferencia = pedido.getReferencia();
                response.pedidoStatus = pedido.getStatus().name();
                response.paymentId = pedido.getPaymentId();
                response.paymentType = pedido.getPaymentType();
                response.gatewayPaymentStatus = pedido.getPaymentStatus();
                response.gatewayPaymentStatusDetail = pedido.getPaymentStatusDetail();
            }
            response.criadoEm = assinatura.getCriadoEm();
            return response;
        }
    }
}
