package com.edupercurso.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "categorias")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Categoria {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String nome;

    private String descricao;

    @Column(name = "ordem_exibicao", nullable = false)
    @Builder.Default
    private Integer ordemExibicao = 0;

    @Enumerated(EnumType.STRING)
    @Column(name = "formato_experiencia", nullable = false)
    @Builder.Default
    private FormatoExperiencia formatoExperiencia = FormatoExperiencia.AULAS;

    @OneToMany(mappedBy = "categoria", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("ordemExibicao ASC, titulo ASC")
    @Builder.Default
    private List<CategoriaGuiaBloco> guiaBlocos = new ArrayList<>();

    public enum FormatoExperiencia {
        AULAS,
        GUIA,
        MISTO
    }
}
