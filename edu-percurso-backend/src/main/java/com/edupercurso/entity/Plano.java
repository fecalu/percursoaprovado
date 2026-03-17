package com.edupercurso.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "planos",
       uniqueConstraints = @UniqueConstraint(columnNames = {"local_prova_id", "duracao_dias"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Plano {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "local_prova_id", nullable = false)
    private LocalProva localProva;

    @Column(nullable = false)
    private String nome;

    @Column(name = "duracao_dias", nullable = false)
    private Integer duracaoDias;

    @Column(name = "preco_centavos", nullable = false)
    private Integer precoCentavos;

    @Builder.Default
    private boolean ativo = true;

    @CreationTimestamp
    @Column(name = "criado_em", updatable = false)
    private LocalDateTime criadoEm;
}
