package com.edupercurso.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class GoogleAuthService {

    private static final String GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
    private static final String GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Value("${google.web-client-id:}")
    private String googleWebClientId;

    @Value("${google.web-client-secret:}")
    private String googleWebClientSecret;

    @Value("${app.base-url:http://localhost}")
    private String appBaseUrl;

    public GoogleAccount validarCredential(String credential) {
        String clientId = requireClientId();

        try {
            GoogleIdToken idToken = buildVerifier(clientId).verify(credential);
            if (idToken == null) {
                throw new IllegalArgumentException("Não foi possível validar a conta Google.");
            }
            return mapearPayload(idToken.getPayload());
        } catch (GeneralSecurityException | IOException ex) {
            throw new IllegalStateException("Falha ao validar a conta Google.", ex);
        }
    }

    public GoogleAccount trocarCodePorConta(String code, String redirectUri, String originHeader, String requestedWith) {
        if (!"XMLHttpRequest".equalsIgnoreCase(normalize(requestedWith))) {
            throw new IllegalArgumentException("Requisição inválida para login com Google.");
        }

        String clientId = requireClientId();
        String clientSecret = requireClientSecret();
        String redirectOrigin = validarRedirectUri(redirectUri, originHeader);

        try {
            GoogleTokenResponse tokenResponse = trocarCodePorTokens(code, redirectOrigin, clientId, clientSecret);
            if (tokenResponse.idToken() != null && !tokenResponse.idToken().isBlank()) {
                GoogleIdToken idToken = buildVerifier(clientId).verify(tokenResponse.idToken());
                if (idToken == null) {
                    throw new IllegalArgumentException("Não foi possível validar a conta Google.");
                }
                return mapearPayload(idToken.getPayload());
            }

            if (tokenResponse.accessToken() == null || tokenResponse.accessToken().isBlank()) {
                throw new IllegalArgumentException("Não foi possível validar a conta Google.");
            }

            return buscarContaViaUserInfo(tokenResponse.accessToken());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Falha ao validar a conta Google.", ex);
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (GeneralSecurityException | IOException ex) {
            throw new IllegalStateException("Falha ao validar a conta Google.", ex);
        }
    }

    private GoogleTokenResponse trocarCodePorTokens(
            String code,
            String redirectOrigin,
            String clientId,
            String clientSecret
    ) throws IOException, InterruptedException {
        String body = formValue("code", code)
                + "&" + formValue("client_id", clientId)
                + "&" + formValue("client_secret", clientSecret)
                + "&" + formValue("redirect_uri", redirectOrigin)
                + "&grant_type=authorization_code";

        HttpRequest request = HttpRequest.newBuilder(URI.create(GOOGLE_TOKEN_URL))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            GoogleOAuthError error = objectMapper.readValue(response.body(), GoogleOAuthError.class);
            throw new IllegalArgumentException(
                    error.errorDescription() == null || error.errorDescription().isBlank()
                            ? "Não foi possível validar a conta Google."
                            : "Google: " + error.errorDescription()
            );
        }

        return objectMapper.readValue(response.body(), GoogleTokenResponse.class);
    }

    private GoogleAccount buscarContaViaUserInfo(String accessToken) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(URI.create(GOOGLE_USERINFO_URL))
                .header("Authorization", "Bearer " + accessToken)
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw new IllegalArgumentException("Não foi possível validar a conta Google.");
        }

        GoogleUserInfo userInfo = objectMapper.readValue(response.body(), GoogleUserInfo.class);
        String email = normalizarEmail(userInfo.email());
        if (email.isEmpty()) {
            throw new IllegalArgumentException("A conta Google informada não possui um e-mail válido.");
        }
        if (!Boolean.TRUE.equals(userInfo.emailVerified())) {
            throw new IllegalArgumentException("Sua conta Google precisa ter o e-mail verificado.");
        }

        String nome = normalize(userInfo.name());
        if (nome.isEmpty()) {
            nome = email.substring(0, email.indexOf('@'));
        }

        return new GoogleAccount(
                normalize(userInfo.sub()),
                email,
                nome,
                normalize(userInfo.picture()).isBlank() ? null : normalize(userInfo.picture()),
                true
        );
    }

    private GoogleIdTokenVerifier buildVerifier(String clientId) {
        return new GoogleIdTokenVerifier.Builder(
                new NetHttpTransport(),
                GsonFactory.getDefaultInstance()
        ).setAudience(Collections.singletonList(clientId)).build();
    }

    private GoogleAccount mapearPayload(GoogleIdToken.Payload payload) {
        String email = normalizarEmail(payload.getEmail());
        if (email.isEmpty()) {
            throw new IllegalArgumentException("A conta Google informada não possui um e-mail válido.");
        }
        if (!Boolean.TRUE.equals(payload.getEmailVerified())) {
            throw new IllegalArgumentException("Sua conta Google precisa ter o e-mail verificado.");
        }

        String nome = payload.get("name") instanceof String value ? value.trim() : "";
        if (nome.isEmpty()) {
            nome = email.substring(0, email.indexOf('@'));
        }

        String avatarUrl = payload.get("picture") instanceof String value ? value.trim() : null;

        return new GoogleAccount(
                payload.getSubject(),
                email,
                nome,
                avatarUrl,
                true
        );
    }

    private String requireClientId() {
        String clientId = googleWebClientId == null ? "" : googleWebClientId.trim();
        if (clientId.isEmpty()) {
            throw new IllegalStateException("Login com Google não configurado no servidor.");
        }
        return clientId;
    }

    private String requireClientSecret() {
        String clientSecret = googleWebClientSecret == null ? "" : googleWebClientSecret.trim();
        if (clientSecret.isEmpty()) {
            throw new IllegalStateException("Login com Google não configurado no servidor.");
        }
        return clientSecret;
    }

    private String normalizarEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private String validarRedirectUri(String redirectUri, String originHeader) {
        String normalizedRedirect = normalizeOrigin(redirectUri);
        if (normalizedRedirect.isBlank()) {
            throw new IllegalArgumentException("Origem inválida para login com Google.");
        }

        String normalizedOriginHeader = normalizeOrigin(originHeader);
        if (!normalizedOriginHeader.isBlank() && !Objects.equals(normalizedRedirect, normalizedOriginHeader)) {
            throw new IllegalArgumentException("Origem inválida para login com Google.");
        }

        Set<String> allowedOrigins = new LinkedHashSet<>();
        String appOrigin = normalizeOrigin(appBaseUrl);
        if (!appOrigin.isBlank()) {
            allowedOrigins.add(appOrigin);
            String wwwVariant = deriveWwwVariant(appOrigin);
            if (!wwwVariant.isBlank()) {
                allowedOrigins.add(wwwVariant);
            }
        }
        allowedOrigins.add("http://localhost");
        allowedOrigins.add("http://localhost:5173");
        allowedOrigins.add("http://127.0.0.1");
        allowedOrigins.add("http://127.0.0.1:5173");

        if (!allowedOrigins.contains(normalizedRedirect)) {
            throw new IllegalArgumentException("Origem inválida para login com Google.");
        }

        return normalizedRedirect;
    }

    private String normalizeOrigin(String value) {
        String normalized = normalize(value);
        if (normalized.isBlank()) {
            return "";
        }

        try {
            URI uri = new URI(normalized);
            if (uri.getScheme() == null || uri.getHost() == null) {
                return "";
            }
            int port = uri.getPort();
            StringBuilder origin = new StringBuilder()
                    .append(uri.getScheme().toLowerCase(Locale.ROOT))
                    .append("://")
                    .append(uri.getHost().toLowerCase(Locale.ROOT));
            if (port != -1) {
                origin.append(":").append(port);
            }
            return origin.toString();
        } catch (URISyntaxException ex) {
            return "";
        }
    }

    private String deriveWwwVariant(String origin) {
        try {
            URI uri = new URI(origin);
            String host = uri.getHost();
            if (host == null || host.equals("localhost") || host.equals("127.0.0.1")) {
                return "";
            }
            String variantHost = host.startsWith("www.") ? host.substring(4) : "www." + host;
            StringBuilder variant = new StringBuilder()
                    .append(uri.getScheme())
                    .append("://")
                    .append(variantHost);
            if (uri.getPort() != -1) {
                variant.append(":").append(uri.getPort());
            }
            return variant.toString();
        } catch (URISyntaxException ex) {
            return "";
        }
    }

    private String formValue(String key, String value) {
        return java.net.URLEncoder.encode(key, StandardCharsets.UTF_8)
                + "="
                + java.net.URLEncoder.encode(normalize(value), StandardCharsets.UTF_8);
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    @Getter
    @RequiredArgsConstructor
    public static class GoogleAccount {
        private final String googleSub;
        private final String email;
        private final String nome;
        private final String avatarUrl;
        private final boolean emailVerificado;
    }

    private record GoogleTokenResponse(
            @JsonProperty("access_token") String accessToken,
            @JsonProperty("id_token") String idToken,
            @JsonProperty("refresh_token") String refreshToken,
            @JsonProperty("scope") String scope,
            @JsonProperty("token_type") String tokenType,
            @JsonProperty("expires_in") Long expiresIn
    ) {
    }

    private record GoogleOAuthError(
            @JsonProperty("error") String error,
            @JsonProperty("error_description") String errorDescription
    ) {
    }

    private record GoogleUserInfo(
            @JsonProperty("sub") String sub,
            @JsonProperty("email") String email,
            @JsonProperty("email_verified") Boolean emailVerified,
            @JsonProperty("name") String name,
            @JsonProperty("picture") String picture
    ) {
    }
}
