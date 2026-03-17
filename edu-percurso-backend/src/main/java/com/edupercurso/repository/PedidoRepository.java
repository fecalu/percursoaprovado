package com.edupercurso.repository;

import com.edupercurso.entity.Pedido;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PedidoRepository extends JpaRepository<Pedido, UUID> {
    List<Pedido> findAllByOrderByCriadoEmDesc();
    List<Pedido> findByUsuarioIdOrderByCriadoEmDesc(UUID usuarioId);
    Optional<Pedido> findByIdAndUsuarioId(UUID id, UUID usuarioId);
    Optional<Pedido> findByReferencia(String referencia);
    Optional<Pedido> findByReferenciaAndUsuarioId(String referencia, UUID usuarioId);
    boolean existsByUsuarioIdAndLocalProvaIdAndStatus(UUID usuarioId, UUID localProvaId, Pedido.Status status);
}
