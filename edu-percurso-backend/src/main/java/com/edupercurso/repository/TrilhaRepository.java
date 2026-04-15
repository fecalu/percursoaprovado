package com.edupercurso.repository;

import com.edupercurso.entity.Trilha;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TrilhaRepository extends JpaRepository<Trilha, UUID> {

    @EntityGraph(attributePaths = {"etapas", "etapas.grupoAcesso"})
    List<Trilha> findAllByOrderByOrdemExibicaoAscNomeAsc();

    @EntityGraph(attributePaths = {"etapas", "etapas.grupoAcesso"})
    List<Trilha> findAllByAtivoTrueOrderByOrdemExibicaoAscNomeAsc();

    Optional<Trilha> findTopByOrderByOrdemExibicaoDesc();

    boolean existsByCodigoIgnoreCase(String codigo);

    boolean existsByCodigoIgnoreCaseAndIdNot(String codigo, UUID id);

    boolean existsByNomeIgnoreCase(String nome);

    boolean existsByNomeIgnoreCaseAndIdNot(String nome, UUID id);
}
