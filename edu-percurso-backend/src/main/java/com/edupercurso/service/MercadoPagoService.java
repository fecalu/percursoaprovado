package com.edupercurso.service;

import com.mercadopago.MercadoPagoConfig;
import com.mercadopago.client.preference.PreferenceBackUrlsRequest;
import com.mercadopago.client.preference.PreferenceClient;
import com.mercadopago.client.preference.PreferenceItemRequest;
import com.mercadopago.client.preference.PreferencePayerRequest;
import com.mercadopago.client.preference.PreferencePaymentMethodsRequest;
import com.mercadopago.client.preference.PreferencePaymentTypeRequest;
import com.mercadopago.client.preference.PreferenceRequest;
import com.mercadopago.client.payment.PaymentClient;
import com.mercadopago.exceptions.MPApiException;
import com.mercadopago.exceptions.MPException;
import com.mercadopago.resources.payment.Payment;
import com.mercadopago.resources.preference.Preference;
import com.edupercurso.entity.Pedido;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Service
public class MercadoPagoService {

    @Value("${mercadopago.access-token:}")
    private String accessToken;

    @Value("${mercadopago.webhook-secret:}")
    private String webhookSecret;

    @Value("${app.base-url:http://localhost}")
    private String appBaseUrl;

    public CheckoutPreference criarPreferencia(Pedido pedido) {
        validarConfiguracao();

        try {
            PreferenceRequest preferenceRequest = PreferenceRequest.builder()
                    .items(List.of(
                            PreferenceItemRequest.builder()
                                    .id(pedido.getId().toString())
                                    .title("Plano " + pedido.getLocalProva().getNome() + " - " + pedido.getPlano().getNome())
                                    .description("Acesso ao local de prova " + pedido.getLocalProva().getNome())
                                    .categoryId("services")
                                    .quantity(1)
                                    .currencyId("BRL")
                                    .unitPrice(BigDecimal.valueOf(pedido.getValorCentavos()).divide(BigDecimal.valueOf(100)))
                                    .build()
                    ))
                    .payer(PreferencePayerRequest.builder()
                            .email(pedido.getUsuario().getEmail())
                            .name(extrairPrimeiroNome(pedido.getUsuario().getNome()))
                            .surname(extrairSobrenome(pedido.getUsuario().getNome()))
                            .build())
                    .externalReference(pedido.getReferencia())
                    .notificationUrl(normalizarBaseUrl() + "/api/mercadopago/webhook")
                    .backUrls(PreferenceBackUrlsRequest.builder()
                            .success(normalizarBaseUrl() + "/checkout/sucesso")
                            .pending(normalizarBaseUrl() + "/checkout/pendente")
                            .failure(normalizarBaseUrl() + "/checkout/falha")
                            .build())
                    .autoReturn("approved")
                    .metadata(Map.of(
                            "pedido_id", pedido.getId().toString(),
                            "local_slug", pedido.getLocalProva().getSlug()
                    ))
                    .paymentMethods(PreferencePaymentMethodsRequest.builder()
                            .excludedPaymentTypes(List.of(
                                    PreferencePaymentTypeRequest.builder().id("ticket").build(),
                                    PreferencePaymentTypeRequest.builder().id("debit_card").build(),
                                    PreferencePaymentTypeRequest.builder().id("prepaid_card").build()
                            ))
                            .installments(12)
                            .build())
                    .build();

            Preference response = new PreferenceClient().create(preferenceRequest);

            String checkoutId = response.getId();
            String checkoutUrl = response.getInitPoint();
            if (!StringUtils.hasText(checkoutUrl)) {
                checkoutUrl = response.getSandboxInitPoint();
            }

            if (!StringUtils.hasText(checkoutId) || !StringUtils.hasText(checkoutUrl)) {
                throw new IllegalStateException("Mercado Pago nao retornou os dados do checkout.");
            }

            return new CheckoutPreference(checkoutId, checkoutUrl);
        } catch (MPApiException ex) {
            throw new IllegalStateException("Falha ao criar checkout no Mercado Pago: " + extrairCorpoErro(ex), ex);
        } catch (MPException ex) {
            throw new IllegalStateException("Falha ao criar checkout no Mercado Pago: " + ex.getMessage(), ex);
        }
    }

    public PaymentDetails consultarPagamento(String paymentId) {
        validarConfiguracao();

        try {
            Payment response = new PaymentClient().get(Long.valueOf(paymentId));

            LocalDateTime approvedAt = null;
            if (Objects.nonNull(response.getDateApproved())) {
                approvedAt = response.getDateApproved().toLocalDateTime();
            }

            return new PaymentDetails(
                    String.valueOf(response.getId()),
                    response.getStatus(),
                    response.getStatusDetail(),
                    response.getPaymentTypeId(),
                    response.getExternalReference(),
                    response.getTransactionAmount(),
                    approvedAt
            );
        } catch (NumberFormatException ex) {
            throw new IllegalStateException("ID de pagamento invalido recebido do Mercado Pago.", ex);
        } catch (MPApiException ex) {
            throw new IllegalStateException("Falha ao consultar pagamento no Mercado Pago: " + extrairCorpoErro(ex), ex);
        } catch (MPException ex) {
            throw new IllegalStateException("Falha ao consultar pagamento no Mercado Pago: " + ex.getMessage(), ex);
        }
    }

    public boolean validarAssinaturaWebhook(String xSignature, String xRequestId, String dataId) {
        if (!StringUtils.hasText(webhookSecret)) {
            return true;
        }
        if (!StringUtils.hasText(xSignature) || !StringUtils.hasText(xRequestId) || !StringUtils.hasText(dataId)) {
            return false;
        }

        Map<String, String> partes = parseSignature(xSignature);
        String ts = partes.get("ts");
        String v1 = partes.get("v1");
        if (!StringUtils.hasText(ts) || !StringUtils.hasText(v1)) {
            return false;
        }

        String manifest = "id:" + dataId.toLowerCase(Locale.ROOT) + ";request-id:" + xRequestId + ";ts:" + ts + ";";
        String assinaturaEsperada = hmacSha256(webhookSecret, manifest);
        return assinaturaEsperada.equalsIgnoreCase(v1);
    }

    private void validarConfiguracao() {
        if (!StringUtils.hasText(accessToken)) {
            throw new IllegalStateException("Mercado Pago nao configurado: access token ausente.");
        }
        if (!StringUtils.hasText(appBaseUrl)) {
            throw new IllegalStateException("APP_BASE_URL nao configurado.");
        }
        MercadoPagoConfig.setAccessToken(accessToken);
    }

    private String normalizarBaseUrl() {
        return appBaseUrl.endsWith("/") ? appBaseUrl.substring(0, appBaseUrl.length() - 1) : appBaseUrl;
    }

    private Map<String, String> parseSignature(String signature) {
        Map<String, String> values = new LinkedHashMap<>();
        for (String part : signature.split(",")) {
            String[] pair = part.trim().split("=", 2);
            if (pair.length == 2) {
                values.put(pair[0], pair[1]);
            }
        }
        return values;
    }

    private String hmacSha256(String secret, String message) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                builder.append(String.format("%02x", b));
            }
            return builder.toString();
        } catch (Exception ex) {
            throw new IllegalStateException("Nao foi possivel validar a assinatura do webhook.", ex);
        }
    }

    private String extrairPrimeiroNome(String nomeCompleto) {
        String[] partes = nomeCompleto == null ? new String[0] : nomeCompleto.trim().split("\\s+");
        return partes.length == 0 ? "Aluno" : partes[0];
    }

    private String extrairSobrenome(String nomeCompleto) {
        String[] partes = nomeCompleto == null ? new String[0] : nomeCompleto.trim().split("\\s+");
        if (partes.length <= 1) {
            return "EduPercurso";
        }
        return String.join(" ", java.util.Arrays.copyOfRange(partes, 1, partes.length));
    }

    private String extrairCorpoErro(MPApiException ex) {
        if (Objects.isNull(ex.getApiResponse()) || !StringUtils.hasText(ex.getApiResponse().getContent())) {
            return ex.getMessage();
        }
        return ex.getApiResponse().getContent();
    }

    public record CheckoutPreference(String id, String checkoutUrl) {
    }

    public record PaymentDetails(
            String id,
            String status,
            String statusDetail,
            String paymentType,
            String externalReference,
            BigDecimal transactionAmount,
            LocalDateTime approvedAt
    ) {
    }
}
