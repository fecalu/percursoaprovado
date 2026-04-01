package com.edupercurso.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.Collections;
import java.util.Locale;

@Service
public class GoogleAuthService {

    @Value("${google.web-client-id:}")
    private String googleWebClientId;

    public GoogleAccount validarCredential(String credential) {
        String clientId = googleWebClientId == null ? "" : googleWebClientId.trim();
        if (clientId.isEmpty()) {
            throw new IllegalStateException("Login com Google nao configurado no servidor.");
        }

        try {
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
                    new NetHttpTransport(),
                    GsonFactory.getDefaultInstance()
            ).setAudience(Collections.singletonList(clientId)).build();

            GoogleIdToken idToken = verifier.verify(credential);
            if (idToken == null) {
                throw new IllegalArgumentException("Nao foi possivel validar a conta Google.");
            }

            GoogleIdToken.Payload payload = idToken.getPayload();
            String email = normalizarEmail(payload.getEmail());
            if (email.isEmpty()) {
                throw new IllegalArgumentException("A conta Google informada nao possui um e-mail valido.");
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
        } catch (GeneralSecurityException | IOException ex) {
            throw new IllegalStateException("Falha ao validar a conta Google.", ex);
        }
    }

    private String normalizarEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
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
}
