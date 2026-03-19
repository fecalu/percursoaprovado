package com.edupercurso.repository;

import com.edupercurso.entity.QuestaoTeorica;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface QuestaoTeoricaRepository extends JpaRepository<QuestaoTeorica, UUID> {

    @Override
    @EntityGraph(attributePaths = "alternativas")
    List<QuestaoTeorica> findAll();

    @Override
    @EntityGraph(attributePaths = "alternativas")
    Optional<QuestaoTeorica> findById(UUID id);

    @EntityGraph(attributePaths = "alternativas")
    List<QuestaoTeorica> findByStatus(QuestaoTeorica.Status status);

    @EntityGraph(attributePaths = "alternativas")
    List<QuestaoTeorica> findByStatusAndTema(QuestaoTeorica.Status status, QuestaoTeorica.Tema tema);
}
