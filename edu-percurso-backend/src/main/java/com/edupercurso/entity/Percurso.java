package com.edupercurso.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "percursos")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Percurso {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String titulo;

    @Column(columnDefinition = "TEXT")
    private String descricao;

    @Column(name = "video_url", nullable = false)
    private String videoUrl;

    @Column(name = "duracao_segundos")
    private Integer duracaoSegundos;

    @Builder.Default
    private boolean ativo = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "categoria_id")
    private Categoria categoria;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "local_prova_id")
    private LocalProva localProva;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_conteudo", nullable = false)
    @Builder.Default
    private TipoConteudo tipoConteudo = TipoConteudo.PERCURSO_REAL;

    @Column(columnDefinition = "TEXT")
    private String resumo;

    @Column(name = "thumbnail_url")
    private String thumbnailUrl;

    @Column(name = "ordem_exibicao")
    @Builder.Default
    private Integer ordemExibicao = 0;

    @Builder.Default
    private boolean destaque = false;

    @CreationTimestamp
    @Column(name = "criado_em", updatable = false)
    private LocalDateTime criadoEm;

    public enum TipoConteudo {
        PERCURSO_REAL,
        SIMULACAO_COMPLETA,
        ERROS_REPROVACAO,
        BALIZA,
        CONTROLE_EMBREAGEM,
        EXAMINADOR
    }
}
