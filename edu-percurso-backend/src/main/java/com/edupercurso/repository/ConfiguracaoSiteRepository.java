package com.edupercurso.repository;

import com.edupercurso.entity.ConfiguracaoSite;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ConfiguracaoSiteRepository extends JpaRepository<ConfiguracaoSite, UUID> {

    Optional<ConfiguracaoSite> findTopByOrderByCriadoEmAsc();
}
