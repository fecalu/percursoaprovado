package com.edupercurso.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "grupos_acesso")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GrupoAcesso {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 120)
    private String codigo;

    @Column(nullable = false, unique = true, length = 140)
    private String nome;

    @Column(columnDefinition = "TEXT")
    private String descricao;

    @Column(name = "ordem_exibicao", nullable = false)
    @Builder.Default
    private Integer ordemExibicao = 0;

    @Builder.Default
    @Column(nullable = false)
    private boolean ativo = true;
}
