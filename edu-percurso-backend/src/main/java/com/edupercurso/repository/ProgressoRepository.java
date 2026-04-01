package com.edupercurso.repository;

import com.edupercurso.entity.ProgressoAluno;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProgressoRepository extends JpaRepository<ProgressoAluno, UUID> {
    List<ProgressoAluno> findByUsuarioId(UUID usuarioId);
    long countByUsuarioId(UUID usuarioId);
    void deleteAllByUsuarioId(UUID usuarioId);
    Optional<ProgressoAluno> findByUsuarioIdAndPercursoId(UUID usuarioId, UUID percursoId);
}
