package com.edupercurso.repository;

import com.edupercurso.entity.PasswordResetToken;
import com.edupercurso.entity.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, UUID> {
    Optional<PasswordResetToken> findByTokenHashAndUsadoEmIsNull(String tokenHash);
    List<PasswordResetToken> findAllByUsuarioAndUsadoEmIsNull(Usuario usuario);
    long countByUsuarioId(UUID usuarioId);
    void deleteAllByUsuarioId(UUID usuarioId);
}
