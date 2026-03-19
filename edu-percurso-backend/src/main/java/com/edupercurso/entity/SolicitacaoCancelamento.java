package com.edupercurso.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "solicitacoes_cancelamento")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SolicitacaoCancelamento {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pedido_id", nullable = false, unique = true)
    private Pedido pedido;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(nullable = false, length = 120)
    private String motivo;

    @Column(name = "observacao_aluno", columnDefinition = "TEXT")
    private String observacaoAluno;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private Status status;

    @Column(name = "observacao_admin", columnDefinition = "TEXT")
    private String observacaoAdmin;

    @Column(name = "processado_por_email")
    private String processadoPorEmail;

    @CreationTimestamp
    @Column(name = "criado_em", updatable = false)
    private LocalDateTime criadoEm;

    @Column(name = "processado_em")
    private LocalDateTime processadoEm;

    @Column(name = "reembolsado_por_email")
    private String reembolsadoPorEmail;

    @Column(name = "reembolsado_em")
    private LocalDateTime reembolsadoEm;

    public enum Status {
        ABERTA,
        APROVADA,
        NEGADA,
        ERRO_PROCESSAMENTO
    }
}
