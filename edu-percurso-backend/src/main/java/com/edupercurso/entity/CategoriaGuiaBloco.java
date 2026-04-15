package com.edupercurso.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "categoria_guia_blocos")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CategoriaGuiaBloco {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "categoria_id", nullable = false)
    @JsonIgnore
    private Categoria categoria;

    @Column(nullable = false)
    private String titulo;

    @Column(columnDefinition = "TEXT")
    private String descricao;

    @Column(name = "texto_detalhado", columnDefinition = "TEXT")
    private String textoDetalhado;

    @Column(name = "imagem_url", columnDefinition = "TEXT")
    private String imagemUrl;

    @Column(name = "imagem_legenda")
    private String imagemLegenda;

    private String icone;

    @OneToMany(mappedBy = "guiaBloco", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("ordemExibicao ASC, titulo ASC")
    @Builder.Default
    private List<CategoriaGuiaItem> itensVisuais = new ArrayList<>();

    @Column(name = "ordem_exibicao", nullable = false)
    @Builder.Default
    private Integer ordemExibicao = 0;

    public void substituirItensVisuais(List<CategoriaGuiaItem> novosItens) {
        this.itensVisuais.clear();
        if (novosItens == null) {
            return;
        }

        novosItens.forEach(item -> {
            item.setGuiaBloco(this);
            this.itensVisuais.add(item);
        });
    }
}
