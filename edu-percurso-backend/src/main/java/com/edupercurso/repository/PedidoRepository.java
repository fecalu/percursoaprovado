package com.edupercurso.repository;

import com.edupercurso.entity.Pedido;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PedidoRepository extends JpaRepository<Pedido, UUID> {
    List<Pedido> findAllByOrderByCriadoEmDesc();
    List<Pedido> findByUsuarioIdOrderByCriadoEmDesc(UUID usuarioId);
    long countByUsuarioId(UUID usuarioId);
    void deleteAllByUsuarioId(UUID usuarioId);
    Optional<Pedido> findByIdAndUsuarioId(UUID id, UUID usuarioId);
    Optional<Pedido> findByReferencia(String referencia);
    Optional<Pedido> findByReferenciaAndUsuarioId(String referencia, UUID usuarioId);
    List<Pedido> findByAssinaturaIdIn(Collection<UUID> assinaturaIds);
    boolean existsByUsuarioIdAndLocalProvaIdAndStatus(UUID usuarioId, UUID localProvaId, Pedido.Status status);

    @Query("""
            select distinct p.usuario.id
            from Pedido p
            where p.usuario.id in :usuarioIds
            """)
    List<UUID> findUsuarioIdsComPedidos(@Param("usuarioIds") Collection<UUID> usuarioIds);
}
