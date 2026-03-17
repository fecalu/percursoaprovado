package com.edupercurso.repository;

import com.edupercurso.entity.LocalProva;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LocalProvaRepository extends JpaRepository<LocalProva, UUID> {
    List<LocalProva> findAllByOrderByOrdemExibicaoAscNomeAsc();
    List<LocalProva> findByAtivoTrueOrderByOrdemExibicaoAscNomeAsc();
    Optional<LocalProva> findBySlug(String slug);
    boolean existsBySlug(String slug);
}
