package com.edupercurso.repository;

import com.edupercurso.entity.Percurso;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PercursoRepository extends JpaRepository<Percurso, UUID> {
    List<Percurso> findByAtivoTrue();
    List<Percurso> findByCategoriaIdAndAtivoTrue(UUID categoriaId);
}
