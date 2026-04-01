package com.edupercurso.repository;

import com.edupercurso.entity.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UsuarioRepository extends JpaRepository<Usuario, UUID> {
    Optional<Usuario> findByEmail(String email);
    Optional<Usuario> findByEmailIgnoreCase(String email);
    Optional<Usuario> findByGoogleSub(String googleSub);
    boolean existsByEmail(String email);
    boolean existsByEmailIgnoreCase(String email);
}
