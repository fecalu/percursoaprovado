package com.edupercurso.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.util.ArrayList;
import java.util.List;
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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trilha_principal_id", nullable = false)
    private Trilha trilhaPrincipal;

    @Builder.Default
    @ManyToMany
    @JoinTable(
            name = "planos_grupos_acesso",
            joinColumns = @JoinColumn(name = "plano_id"),
            inverseJoinColumns = @JoinColumn(name = "grupo_acesso_id")
    )
    private List<GrupoAcesso> gruposAcesso = new ArrayList<>();

    @Column(nullable = false)
    private String nome;

    @Column(name = "duracao_dias", nullable = false)
    private Integer duracaoDias;

    @Column(name = "preco_centavos", nullable = false)
    private Integer precoCentavos;

    @Builder.Default
    private boolean ativo = true;

    @Builder.Default
    @Column(name = "usar_checkout_personalizado", nullable = false)
    private boolean usarCheckoutPersonalizado = false;

    @Column(name = "checkout_kicker", columnDefinition = "TEXT")
    private String checkoutKicker;

    @Column(name = "checkout_titulo", columnDefinition = "TEXT")
    private String checkoutTitulo;

    @Column(name = "checkout_subtitulo", columnDefinition = "TEXT")
    private String checkoutSubtitulo;

    @Column(name = "checkout_beneficios_titulo", columnDefinition = "TEXT")
    private String checkoutBeneficiosTitulo;

    @Column(name = "checkout_beneficios_texto", columnDefinition = "TEXT")
    private String checkoutBeneficiosTexto;

    @Column(name = "checkout_ajuda_titulo", columnDefinition = "TEXT")
    private String checkoutAjudaTitulo;

    @Column(name = "checkout_ajuda_texto", columnDefinition = "TEXT")
    private String checkoutAjudaTexto;

    @Column(name = "checkout_confianca_texto", columnDefinition = "TEXT")
    private String checkoutConfiancaTexto;

    @Column(name = "checkout_resumo_kicker", columnDefinition = "TEXT")
    private String checkoutResumoKicker;

    @Column(name = "checkout_resumo_texto", columnDefinition = "TEXT")
    private String checkoutResumoTexto;

    @Column(name = "checkout_preco_label", columnDefinition = "TEXT")
    private String checkoutPrecoLabel;

    @Column(name = "checkout_preco_texto", columnDefinition = "TEXT")
    private String checkoutPrecoTexto;

    @Column(name = "checkout_seguro_texto", columnDefinition = "TEXT")
    private String checkoutSeguroTexto;

    @Column(name = "vitrine_selo", columnDefinition = "TEXT")
    private String vitrineSelo;

    @Column(name = "vitrine_resumo", columnDefinition = "TEXT")
    private String vitrineResumo;

    @Column(name = "vitrine_texto", columnDefinition = "TEXT")
    private String vitrineTexto;

    @Column(name = "vitrine_meta", columnDefinition = "TEXT")
    private String vitrineMeta;

    @Column(name = "vitrine_recomendada")
    private Boolean vitrineRecomendada;

    @CreationTimestamp
    @Column(name = "criado_em", updatable = false)
    private LocalDateTime criadoEm;
}
