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

    @Column(name = "imagem_principal_url", length = 500)
    private String imagemPrincipalUrl;

    @Column(name = "titulo_comercial")
    private String tituloComercial;

    @Column(name = "subtitulo_comercial", columnDefinition = "TEXT")
    private String subtituloComercial;

    @Column(name = "box_titulo")
    private String boxTitulo;

    @Column(name = "box_item_1")
    private String boxItem1;

    @Column(name = "box_item_2")
    private String boxItem2;

    @Column(name = "box_item_3")
    private String boxItem3;

    @Column(name = "box_observacao", columnDefinition = "TEXT")
    private String boxObservacao;

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
