package com.edupercurso.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "usuarios")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String nome;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "senha_hash")
    private String senhaHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "auth_provider", nullable = false)
    private AuthProvider authProvider;

    @Column(name = "google_sub")
    private String googleSub;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @Column(name = "email_verificado", nullable = false)
    private boolean emailVerificado;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Column(name = "senha_alterada_em")
    private LocalDateTime senhaAlteradaEm;

    @Column(name = "termos_aceitos_em")
    private LocalDateTime termosAceitosEm;

    @Column(name = "politica_privacidade_aceita_em")
    private LocalDateTime politicaPrivacidadeAceitaEm;

    @CreationTimestamp
    @Column(name = "criado_em", updatable = false)
    private LocalDateTime criadoEm;

    public enum Role {
        ALUNO, ADMIN
    }

    public enum AuthProvider {
        LOCAL, GOOGLE
    }
}
