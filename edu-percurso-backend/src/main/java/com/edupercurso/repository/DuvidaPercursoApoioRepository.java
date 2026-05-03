package com.edupercurso.repository;

import com.edupercurso.entity.DuvidaPercursoApoio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface DuvidaPercursoApoioRepository extends JpaRepository<DuvidaPercursoApoio, UUID> {

    boolean existsByDuvidaIdAndUsuarioId(UUID duvidaId, UUID usuarioId);

    void deleteByDuvidaIdAndUsuarioId(UUID duvidaId, UUID usuarioId);

    @Query("""
            select apoio.duvida.id, count(apoio.id)
            from DuvidaPercursoApoio apoio
            where apoio.duvida.id in :duvidaIds
            group by apoio.duvida.id
            """)
    List<Object[]> contarPorDuvidaIds(@Param("duvidaIds") Collection<UUID> duvidaIds);

    @Query("""
            select apoio.duvida.id
            from DuvidaPercursoApoio apoio
            where apoio.usuario.id = :usuarioId
              and apoio.duvida.id in :duvidaIds
            """)
    List<UUID> listarDuvidaIdsApoiadasPorUsuario(
            @Param("usuarioId") UUID usuarioId,
            @Param("duvidaIds") Collection<UUID> duvidaIds
    );
}
