package com.edupercurso.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "categoria_guia_itens")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CategoriaGuiaItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guia_bloco_id", nullable = false)
    @JsonIgnore
    private CategoriaGuiaBloco guiaBloco;

    @Column(nullable = false)
    private String titulo;

    @Column(columnDefinition = "TEXT")
    private String descricao;

    @Column(name = "imagem_url", columnDefinition = "TEXT")
    private String imagemUrl;

    @Column(name = "imagem_legenda")
    private String imagemLegenda;

    @Column(name = "ordem_exibicao", nullable = false)
    @Builder.Default
    private Integer ordemExibicao = 0;
}
