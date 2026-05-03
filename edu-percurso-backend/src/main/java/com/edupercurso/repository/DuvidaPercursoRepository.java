package com.edupercurso.repository;

import com.edupercurso.entity.DuvidaPercurso;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface DuvidaPercursoRepository extends JpaRepository<DuvidaPercurso, UUID> {

    List<DuvidaPercurso> findByPercursoIdAndStatusIn(UUID percursoId, Collection<DuvidaPercurso.Status> statuses);
}
