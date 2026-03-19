package com.edupercurso.dto;

import com.edupercurso.entity.Pedido;
import com.edupercurso.entity.SolicitacaoCancelamento;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

public class PedidoDTO {

    @Data
    public static class CreateRequest {
        @NotNull
        private UUID planoId;
    }

    @Data
    public static class SyncRequest {
        @NotNull
        private String paymentId;

        @NotNull
        private String externalReference;
    }

    @Data
    public static class Response {
        private UUID id;
        private UUID planoId;
        private String planoNome;
        private Integer duracaoDias;
        private UUID localProvaId;
        private String localProvaNome;
        private String localProvaSlug;
        private UUID assinaturaId;
        private Integer valorCentavos;
        private String referencia;
        private String metodoPagamento;
        private String status;
        private String checkoutId;
        private String checkoutUrl;
        private String paymentId;
        private String paymentType;
        private String paymentStatus;
        private String paymentStatusDetail;
        private LocalDateTime pagoEm;
        private LocalDateTime criadoEm;
        private Boolean podeSolicitarCancelamento;
        private LocalDateTime prazoCancelamentoExpiraEm;
        private UUID solicitacaoCancelamentoId;
        private String solicitacaoCancelamentoStatus;
        private LocalDateTime solicitacaoCancelamentoCriadaEm;
        private LocalDateTime solicitacaoCancelamentoProcessadaEm;

        public static Response from(Pedido pedido) {
            return from(pedido, null, false, null);
        }

        public static Response from(
                Pedido pedido,
                SolicitacaoCancelamento solicitacaoCancelamento,
                boolean podeSolicitarCancelamento,
                LocalDateTime prazoCancelamentoExpiraEm) {
            Response response = new Response();
            response.id = pedido.getId();
            response.planoId = pedido.getPlano().getId();
            response.planoNome = pedido.getPlano().getNome();
            response.duracaoDias = pedido.getPlano().getDuracaoDias();
            response.localProvaId = pedido.getLocalProva().getId();
            response.localProvaNome = pedido.getLocalProva().getNome();
            response.localProvaSlug = pedido.getLocalProva().getSlug();
            response.assinaturaId = pedido.getAssinatura() == null ? null : pedido.getAssinatura().getId();
            response.valorCentavos = pedido.getValorCentavos();
            response.referencia = pedido.getReferencia();
            response.metodoPagamento = pedido.getMetodoPagamento().name();
            response.status = pedido.getStatus().name();
            response.checkoutId = pedido.getCheckoutId();
            response.checkoutUrl = pedido.getCheckoutUrl();
            response.paymentId = pedido.getPaymentId();
            response.paymentType = pedido.getPaymentType();
            response.paymentStatus = pedido.getPaymentStatus();
            response.paymentStatusDetail = pedido.getPaymentStatusDetail();
            response.pagoEm = pedido.getPagoEm();
            response.criadoEm = pedido.getCriadoEm();
            response.podeSolicitarCancelamento = podeSolicitarCancelamento;
            response.prazoCancelamentoExpiraEm = prazoCancelamentoExpiraEm;
            if (solicitacaoCancelamento != null) {
                response.solicitacaoCancelamentoId = solicitacaoCancelamento.getId();
                response.solicitacaoCancelamentoStatus = solicitacaoCancelamento.getStatus().name();
                response.solicitacaoCancelamentoCriadaEm = solicitacaoCancelamento.getCriadoEm();
                response.solicitacaoCancelamentoProcessadaEm = solicitacaoCancelamento.getProcessadoEm();
            }
            return response;
        }
    }
}
