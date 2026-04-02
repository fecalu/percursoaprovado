package com.edupercurso.repository;

import com.edupercurso.entity.Categoria;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CategoriaRepository extends JpaRepository<Categoria, UUID> {
    List<Categoria> findAllByOrderByOrdemExibicaoAscNomeAsc();
    Optional<Categoria> findTopByOrderByOrdemExibicaoDesc();
}
