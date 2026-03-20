package com.edupercurso.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "pontos_atencao_percurso")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PontoAtencaoPercurso {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "percurso_id", nullable = false)
    private Percurso percurso;

    @Column(name = "timestamp_segundos", nullable = false)
    private Integer timestampSegundos;

    @Column(nullable = false)
    private String titulo;

    @Column(name = "descricao_curta", columnDefinition = "TEXT")
    private String descricaoCurta;

    @Column(name = "descricao_detalhada", columnDefinition = "TEXT")
    private String descricaoDetalhada;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    @Builder.Default
    private Tipo tipo = Tipo.DICA_IMPORTANTE;

    @Column(name = "imagem_url", columnDefinition = "TEXT")
    private String imagemUrl;

    @Column(name = "video_url", columnDefinition = "TEXT")
    private String videoUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "modo_exibicao", nullable = false, length = 20)
    @Builder.Default
    private ModoExibicao modoExibicao = ModoExibicao.CLIQUE;

    @Column(name = "ordem_exibicao", nullable = false)
    @Builder.Default
    private Integer ordemExibicao = 0;

    @Builder.Default
    @Column(nullable = false)
    private boolean ativo = true;

    public enum Tipo {
        DICA_IMPORTANTE,
        ERRO_COMUM,
        PLACA,
        REFERENCIA_VISUAL,
        OBSERVACAO_EXAMINADOR
    }

    public enum ModoExibicao {
        CLIQUE,
        AUTOMATICO,
        APENAS_LISTA
    }
}
