package com.edupercurso.repository;

import com.edupercurso.entity.Assinatura;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface AssinaturaRepository extends JpaRepository<Assinatura, UUID> {
    List<Assinatura> findAllByOrderByCriadoEmDesc();
    List<Assinatura> findByUsuarioIdOrderByFimEmDesc(UUID usuarioId);

    @Query("""
            select a
            from Assinatura a
            where a.usuario.id = :usuarioId
              and a.status = com.edupercurso.entity.Assinatura.Status.ATIVA
              and a.paymentStatus = com.edupercurso.entity.Assinatura.PaymentStatus.PAGO
              and a.inicioEm <= :agora
              and a.fimEm >= :agora
            order by a.fimEm desc
            """)
    List<Assinatura> findAtivasByUsuarioId(UUID usuarioId, LocalDateTime agora);

    @Query("""
            select case when count(a) > 0 then true else false end
            from Assinatura a
            where a.usuario.id = :usuarioId
              and a.localProva.id = :localProvaId
              and a.status = com.edupercurso.entity.Assinatura.Status.ATIVA
              and a.paymentStatus = com.edupercurso.entity.Assinatura.PaymentStatus.PAGO
              and a.inicioEm <= :agora
              and a.fimEm >= :agora
            """)
    boolean existsAssinaturaAtiva(UUID usuarioId, UUID localProvaId, LocalDateTime agora);

    @Query("""
            select case when count(a) > 0 then true else false end
            from Assinatura a
            where a.usuario.id = :usuarioId
              and a.status = com.edupercurso.entity.Assinatura.Status.ATIVA
              and a.paymentStatus = com.edupercurso.entity.Assinatura.PaymentStatus.PAGO
              and a.inicioEm <= :agora
              and a.fimEm >= :agora
            """)
    boolean existsQualquerAssinaturaAtiva(UUID usuarioId, LocalDateTime agora);
}
