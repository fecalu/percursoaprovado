package com.edupercurso.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "trilha_etapas")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrilhaEtapa {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trilha_id", nullable = false)
    private Trilha trilha;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "grupo_acesso_id", nullable = false)
    private GrupoAcesso grupoAcesso;

    @Column(nullable = false, length = 140)
    private String titulo;

    @Column(columnDefinition = "TEXT")
    private String resumo;

    @Column(name = "ordem_exibicao", nullable = false)
    @Builder.Default
    private Integer ordemExibicao = 0;

    @Builder.Default
    @Column(nullable = false)
    private boolean ativo = true;
}
