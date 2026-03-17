package com.edupercurso.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "progresso_aluno",
       uniqueConstraints = @UniqueConstraint(columnNames = {"usuario_id", "percurso_id"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ProgressoAluno {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "percurso_id", nullable = false)
    private Percurso percurso;

    @Column(name = "segundos_assistidos")
    @Builder.Default
    private Integer segundosAssistidos = 0;

    @Builder.Default
    private boolean concluido = false;

    @Column(name = "ultima_vez")
    private LocalDateTime ultimaVez;
}
