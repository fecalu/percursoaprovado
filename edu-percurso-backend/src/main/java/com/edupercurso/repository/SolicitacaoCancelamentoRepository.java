package com.edupercurso.repository;

import com.edupercurso.entity.SolicitacaoCancelamento;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SolicitacaoCancelamentoRepository extends JpaRepository<SolicitacaoCancelamento, UUID> {
    Optional<SolicitacaoCancelamento> findByPedidoId(UUID pedidoId);
    boolean existsByPedidoId(UUID pedidoId);
    List<SolicitacaoCancelamento> findByPedidoIdIn(Collection<UUID> pedidoIds);
    List<SolicitacaoCancelamento> findAllByOrderByCriadoEmDesc();
    long countByUsuarioId(UUID usuarioId);
    void deleteAllByUsuarioId(UUID usuarioId);
}
