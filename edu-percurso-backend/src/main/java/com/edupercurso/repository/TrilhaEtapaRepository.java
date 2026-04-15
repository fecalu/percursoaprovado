package com.edupercurso.repository;

import com.edupercurso.entity.TrilhaEtapa;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface TrilhaEtapaRepository extends JpaRepository<TrilhaEtapa, UUID> {
    long countByGrupoAcessoId(UUID grupoAcessoId);
}
