package com.edupercurso.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "duvidas_percurso")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DuvidaPercurso {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "percurso_id", nullable = false)
    private Percurso percurso;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "duvida_principal_id")
    private DuvidaPercurso duvidaPrincipal;

    @Column(name = "timestamp_segundos", nullable = false)
    private Integer timestampSegundos;

    @Column(nullable = false, length = 180)
    private String titulo;

    @Column(columnDefinition = "TEXT")
    private String descricao;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private Status status;

    @Column(name = "resposta_oficial", columnDefinition = "TEXT")
    private String respostaOficial;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "respondida_por_id")
    private Usuario respondidaPor;

    @Column(name = "publicada_em")
    private LocalDateTime publicadaEm;

    @Column(name = "resposta_criada_em")
    private LocalDateTime respostaCriadaEm;

    @CreationTimestamp
    @Column(name = "criada_em", nullable = false, updatable = false)
    private LocalDateTime criadaEm;

    @UpdateTimestamp
    @Column(name = "atualizada_em", nullable = false)
    private LocalDateTime atualizadaEm;

    public enum Status {
        PENDENTE_MODERACAO,
        PUBLICADA,
        RESPONDIDA,
        RESOLVIDA,
        OCULTA,
        FUNDIDA
    }
}
