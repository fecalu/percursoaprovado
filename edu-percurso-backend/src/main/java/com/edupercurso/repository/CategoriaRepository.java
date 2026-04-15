package com.edupercurso.repository;

import com.edupercurso.entity.Categoria;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CategoriaRepository extends JpaRepository<Categoria, UUID> {
    List<Categoria> findAllByOrderByOrdemExibicaoAscNomeAsc();
    Optional<Categoria> findTopByOrderByOrdemExibicaoDesc();

    @Query(value = """
            select distinct pga.grupo_acesso_id
            from assinaturas a
            join planos_grupos_acesso pga on pga.plano_id = a.plano_id
            where a.usuario_id = :usuarioId
              and a.status = 'ATIVA'
              and a.payment_status = 'PAGO'
              and a.inicio_em <= :agora
              and a.fim_em >= :agora
            """, nativeQuery = true)
    List<UUID> findGrupoAcessoIdsLiberadosPorUsuario(
            @Param("usuarioId") UUID usuarioId,
            @Param("agora") LocalDateTime agora
    );
}
