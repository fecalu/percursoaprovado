package com.edupercurso.repository;

import com.edupercurso.entity.GrupoAcesso;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GrupoAcessoRepository extends JpaRepository<GrupoAcesso, UUID> {
    List<GrupoAcesso> findAllByOrderByOrdemExibicaoAscNomeAsc();
    Optional<GrupoAcesso> findTopByOrderByOrdemExibicaoDesc();
    boolean existsByCodigoIgnoreCase(String codigo);
    boolean existsByCodigoIgnoreCaseAndIdNot(String codigo, UUID id);
    boolean existsByNomeIgnoreCase(String nome);
    boolean existsByNomeIgnoreCaseAndIdNot(String nome, UUID id);
}
