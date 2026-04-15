package com.edupercurso.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "trilhas")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Trilha {

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

    @OneToMany(mappedBy = "trilha", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("ordemExibicao ASC, titulo ASC")
    @Builder.Default
    private List<TrilhaEtapa> etapas = new ArrayList<>();

    public void substituirEtapas(List<TrilhaEtapa> novasEtapas) {
        this.etapas.clear();
        if (novasEtapas == null) {
            return;
        }

        novasEtapas.forEach(etapa -> {
            etapa.setTrilha(this);
            this.etapas.add(etapa);
        });
    }
}
