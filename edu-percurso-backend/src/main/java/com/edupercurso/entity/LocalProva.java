package com.edupercurso.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "locais_prova")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LocalProva {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String nome;

    @Column(nullable = false, unique = true)
    private String slug;

    @Column(columnDefinition = "TEXT")
    private String descricao;

    @Column(nullable = false)
    @Builder.Default
    private String cidade = "Sao Luis";

    @Builder.Default
    private boolean ativo = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "status_comercial", nullable = false)
    @Builder.Default
    private StatusComercial statusComercial = StatusComercial.RASCUNHO;

    @Column(name = "mensagem_publica", columnDefinition = "TEXT")
    private String mensagemPublica;

    @Column(name = "ordem_exibicao")
    @Builder.Default
    private Integer ordemExibicao = 0;

    @CreationTimestamp
    @Column(name = "criado_em", updatable = false)
    private LocalDateTime criadoEm;

    public enum StatusComercial {
        RASCUNHO,
        EM_BREVE,
        DISPONIVEL,
        PAUSADO
    }
}
