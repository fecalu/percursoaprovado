package com.edupercurso.controller;

import com.edupercurso.service.MercadoPagoService;
import com.edupercurso.service.PedidoService;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/mercadopago")
@RequiredArgsConstructor
@Slf4j
public class MercadoPagoController {

    private final MercadoPagoService mercadoPagoService;
    private final PedidoService pedidoService;

    @PostMapping("/webhook")
    public ResponseEntity<Void> webhook(
            @RequestParam Map<String, String> params,
            @RequestBody(required = false) JsonNode body,
            @RequestHeader(value = "x-signature", required = false) String xSignature,
            @RequestHeader(value = "x-request-id", required = false) String xRequestId) {

        String type = obterValor(
                params.get("type"),
                params.get("topic"),
                body == null ? null : body.path("type").asText(null),
                body == null ? null : body.path("topic").asText(null)
        );
        String dataId = obterValor(
                params.get("data.id"),
                params.get("id"),
                body == null ? null : body.path("data").path("id").asText(null),
                body == null ? null : body.path("id").asText(null)
        );

        if (!StringUtils.hasText(type) || !"payment".equalsIgnoreCase(type) || !StringUtils.hasText(dataId)) {
            return ResponseEntity.ok().build();
        }

        if (!mercadoPagoService.validarAssinaturaWebhook(xSignature, xRequestId, dataId)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            pedidoService.processarPagamentoMercadoPago(dataId);
        } catch (IllegalArgumentException ex) {
            log.warn("Webhook Mercado Pago ignorado para pagamento {}: {}", dataId, ex.getMessage());
        }

        return ResponseEntity.ok().build();
    }

    private String obterValor(String... valores) {
        for (String valor : valores) {
            if (StringUtils.hasText(valor)) {
                return valor;
            }
        }
        return null;
    }
}
