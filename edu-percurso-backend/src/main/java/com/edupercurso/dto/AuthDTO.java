package com.edupercurso.dto;

import com.edupercurso.entity.Usuario;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

public class AuthDTO {

    @Data
    public static class RegisterRequest {
        @NotBlank(message = "Informe seu nome completo.")
        private String nome;

        @NotBlank(message = "Informe seu e-mail.")
        @Email(message = "Informe um e-mail valido.")
        private String email;

        @Size(min = 6, message = "A senha deve ter pelo menos 6 caracteres.")
        private String senha;
    }

    @Data
    public static class LoginRequest {
        @NotBlank(message = "Informe seu e-mail.")
        @Email(message = "Informe um e-mail valido.")
        private String email;

        @NotBlank(message = "Informe sua senha.")
        private String senha;
    }

    @Data
    public static class GoogleLoginRequest {
        @NotBlank(message = "Nao foi possivel validar a conta Google.")
        private String credential;
    }

    @Data
    public static class ForgotPasswordRequest {
        @NotBlank(message = "Informe seu e-mail.")
        @Email(message = "Informe um e-mail valido.")
        private String email;
    }

    @Data
    public static class ResetPasswordRequest {
        @NotBlank(message = "Informe o token de redefinicao.")
        private String token;

        @Size(min = 6, message = "A nova senha deve ter pelo menos 6 caracteres.")
        private String novaSenha;
    }

    @Data
    public static class MessageResponse {
        private String mensagem;

        public MessageResponse(String mensagem) {
            this.mensagem = mensagem;
        }
    }

    @Data
    public static class LoginResponse {
        private String token;
        private String nome;
        private String role;
        private String provider;

        public LoginResponse(String token, String nome, Usuario.Role role, Usuario.AuthProvider provider) {
            this.token = token;
            this.nome = nome;
            this.role = role.name();
            this.provider = provider.name();
        }
    }
}
