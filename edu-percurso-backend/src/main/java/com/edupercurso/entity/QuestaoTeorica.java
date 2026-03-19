package com.edupercurso.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "questoes_teoricas")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuestaoTeorica {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String enunciado;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private Tema tema;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Dificuldade dificuldade = Dificuldade.MEDIA;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.RASCUNHO;

    @Column(name = "explicacao_curta", nullable = false, columnDefinition = "TEXT")
    private String explicacaoCurta;

    @Column(name = "explicacao_detalhada", columnDefinition = "TEXT")
    private String explicacaoDetalhada;

    @Column(name = "video_url", columnDefinition = "TEXT")
    private String videoUrl;

    @Column(name = "ordem_exibicao")
    @Builder.Default
    private Integer ordemExibicao = 0;

    @CreationTimestamp
    @Column(name = "criado_em", updatable = false)
    private LocalDateTime criadoEm;

    @OneToMany(mappedBy = "questao", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("ordem ASC")
    @Builder.Default
    private List<QuestaoAlternativa> alternativas = new ArrayList<>();

    public void substituirAlternativas(List<QuestaoAlternativa> novasAlternativas) {
        this.alternativas.clear();
        if (novasAlternativas == null) {
            return;
        }

        novasAlternativas.forEach(alternativa -> {
            alternativa.setQuestao(this);
            this.alternativas.add(alternativa);
        });
    }

    public enum Tema {
        PLACAS,
        LEGISLACAO,
        DIRECAO_DEFENSIVA,
        PRIMEIROS_SOCORROS,
        MECANICA_BASICA,
        MEIO_AMBIENTE_CIDADANIA
    }

    public enum Dificuldade {
        FACIL,
        MEDIA,
        DIFICIL
    }

    public enum Status {
        RASCUNHO,
        PUBLICADA,
        ARQUIVADA
    }
}
