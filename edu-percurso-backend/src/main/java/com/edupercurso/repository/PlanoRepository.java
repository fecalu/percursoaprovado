package com.edupercurso.repository;

import com.edupercurso.entity.Plano;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PlanoRepository extends JpaRepository<Plano, UUID> {
    List<Plano> findByAtivoTrueOrderByDuracaoDiasAsc();
    List<Plano> findByLocalProvaSlugAndAtivoTrueOrderByDuracaoDiasAsc(String localSlug);
    List<Plano> findByLocalProvaIdOrderByDuracaoDiasAsc(UUID localProvaId);
}
