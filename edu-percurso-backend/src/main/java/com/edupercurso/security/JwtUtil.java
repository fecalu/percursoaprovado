package com.edupercurso.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;

@Component
public class JwtUtil {

    private static final long GOOGLE_SIGNUP_TOKEN_EXPIRACAO_MS = 10 * 60 * 1000L;
    private final SecretKey key;
    private final long expiracaoMs;

    public JwtUtil(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiracao-ms:86400000}") long expiracaoMs) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes());
        this.expiracaoMs = expiracaoMs;
    }

    public String gerar(String email, String role) {
        return Jwts.builder()
                .subject(email)
                .claim("role", role)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiracaoMs))
                .signWith(key)
                .compact();
    }

    public String gerarTokenCadastroGooglePendente(
            String googleSub,
            String email,
            String nome,
            String avatarUrl,
            boolean emailVerificado
    ) {
        var builder = Jwts.builder()
                .subject(email)
                .claim("purpose", "google-signup-pending")
                .claim("googleSub", googleSub)
                .claim("nome", nome)
                .claim("emailVerificado", emailVerificado)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + GOOGLE_SIGNUP_TOKEN_EXPIRACAO_MS));

        if (avatarUrl != null && !avatarUrl.isBlank()) {
            builder.claim("avatarUrl", avatarUrl);
        }

        return builder.signWith(key).compact();
    }

    public GoogleSignupPending extrairTokenCadastroGooglePendente(String token) {
        Claims claims = claims(token);
        String purpose = claims.get("purpose", String.class);
        if (!"google-signup-pending".equals(purpose)) {
            throw new JwtException("Token invalido para cadastro Google.");
        }

        return new GoogleSignupPending(
                claims.get("googleSub", String.class),
                claims.getSubject(),
                claims.get("nome", String.class),
                claims.get("avatarUrl", String.class),
                Boolean.TRUE.equals(claims.get("emailVerificado", Boolean.class))
        );
    }

    public String extrairEmail(String token) {
        return claims(token).getSubject();
    }

    public String extrairRole(String token) {
        return claims(token).get("role", String.class);
    }

    public Date extrairEmitidoEm(String token) {
        return claims(token).getIssuedAt();
    }

    public boolean valido(String token) {
        try {
            claims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    private Claims claims(String token) {
        return Jwts.parser().verifyWith(key).build()
                .parseSignedClaims(token).getPayload();
    }

    public record GoogleSignupPending(
            String googleSub,
            String email,
            String nome,
            String avatarUrl,
            boolean emailVerificado
    ) {
    }
}
