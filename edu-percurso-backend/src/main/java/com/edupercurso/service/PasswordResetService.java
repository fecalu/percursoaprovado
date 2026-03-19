package com.edupercurso.service;

import com.edupercurso.entity.PasswordResetToken;
import com.edupercurso.entity.Usuario;
import com.edupercurso.repository.PasswordResetTokenRepository;
import com.edupercurso.repository.UsuarioRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;

@Service
@RequiredArgsConstructor
@Slf4j
public class PasswordResetService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final UsuarioRepository usuarioRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    @Value("${app.base-url}")
    private String appBaseUrl;

    @Value("${app.password-reset.expiration-minutes:30}")
    private long expirationMinutes;

    @Transactional
    public void solicitarRedefinicao(String email) {
        usuarioRepository.findByEmail(email).ifPresent(usuario -> {
            invalidarTokensPendentes(usuario, LocalDateTime.now());

            String token = gerarToken();
            String tokenHash = hash(token);
            LocalDateTime expiraEm = LocalDateTime.now().plusMinutes(expirationMinutes);

            passwordResetTokenRepository.save(
                    PasswordResetToken.builder()
                            .usuario(usuario)
                            .tokenHash(tokenHash)
                            .expiraEm(expiraEm)
                            .build()
            );

            String link = "%s/reset-password?token=%s".formatted(appBaseUrl, token);

            try {
                emailService.enviarRedefinicaoSenha(usuario.getEmail(), usuario.getNome(), link, expirationMinutes);
            } catch (Exception ex) {
                log.error("Falha ao enviar e-mail de redefinicao para {}", usuario.getEmail(), ex);
            }
        });
    }

    @Transactional
    public void redefinirSenha(String token, String novaSenha) {
        String tokenHash = hash(token);
        PasswordResetToken resetToken = passwordResetTokenRepository.findByTokenHashAndUsadoEmIsNull(tokenHash)
                .orElseThrow(() -> new IllegalArgumentException("Link de redefinicao invalido ou expirado."));

        if (resetToken.getExpiraEm().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Link de redefinicao invalido ou expirado.");
        }

        Usuario usuario = resetToken.getUsuario();
        LocalDateTime agora = LocalDateTime.now();

        usuario.setSenhaHash(passwordEncoder.encode(novaSenha));
        usuario.setSenhaAlteradaEm(agora);
        usuarioRepository.save(usuario);

        invalidarTokensPendentes(usuario, agora);
    }

    private void invalidarTokensPendentes(Usuario usuario, LocalDateTime usadoEm) {
        passwordResetTokenRepository.findAllByUsuarioAndUsadoEmIsNull(usuario)
                .forEach(token -> token.setUsadoEm(usadoEm));
    }

    private String gerarToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hash(String valor) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(valor.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b & 0xff));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("Falha ao gerar hash do token.", ex);
        }
    }
}
