package com.edupercurso.dto;

import com.edupercurso.entity.Usuario;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public class AdminUsuarioDTO {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ListItem {
        private UUID id;
        private String nome;
        private String email;
        private Usuario.AuthProvider authProvider;
        private boolean emailVerificado;
        private LocalDateTime criadoEm;
        private boolean possuiPedidos;
        private boolean possuiAssinaturas;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Summary {
        private long totalAlunos;
        private long somenteCadastro;
        private long comPedido;
        private long comAssinatura;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ListResponse {
        private List<ListItem> usuarios;
        private Summary resumo;
    }

    @Data
    public static class DeleteTestAlunoRequest {
        @NotBlank(message = "Informe o e-mail do aluno.")
        @Email(message = "Informe um e-mail válido.")
        private String email;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DeleteTestAlunoResponse {
        private String mensagem;
        private String email;
        private long tokensExcluidos;
        private long respostasExcluidas;
        private long progressoExcluido;
        private long solicitacoesExcluidas;
        private long pedidosExcluidos;
        private long assinaturasExcluidas;
    }
}
