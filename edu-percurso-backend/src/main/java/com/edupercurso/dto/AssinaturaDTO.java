package com.edupercurso.dto;

import com.edupercurso.entity.Assinatura;
import jakarta.validation.constraints.Email;
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
        private LocalDateTime inicioEm;
        private LocalDateTime fimEm;
        private String status;
        private String paymentStatus;
        private LocalDateTime criadoEm;

        public static Response from(Assinatura assinatura) {
            Response response = new Response();
            response.id = assinatura.getId();
            response.planoId = assinatura.getPlano().getId();
            response.planoNome = assinatura.getPlano().getNome();
            response.duracaoDias = assinatura.getPlano().getDuracaoDias();
            response.localProvaId = assinatura.getLocalProva().getId();
            response.localProvaNome = assinatura.getLocalProva().getNome();
            response.localProvaSlug = assinatura.getLocalProva().getSlug();
            response.inicioEm = assinatura.getInicioEm();
            response.fimEm = assinatura.getFimEm();
            response.status = assinatura.getStatus().name();
            response.paymentStatus = assinatura.getPaymentStatus().name();
            response.criadoEm = assinatura.getCriadoEm();
            return response;
        }
    }
}
