package com.edupercurso.repository;

import com.edupercurso.entity.RespostaQuestaoAluno;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface RespostaQuestaoAlunoRepository extends JpaRepository<RespostaQuestaoAluno, UUID> {
    long countByUsuarioId(UUID usuarioId);
    void deleteAllByUsuarioId(UUID usuarioId);
}
