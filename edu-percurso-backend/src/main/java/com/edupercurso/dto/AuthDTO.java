package com.edupercurso.dto;

import com.edupercurso.entity.Usuario;
import jakarta.validation.constraints.AssertTrue;
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
        @Email(message = "Informe um e-mail válido.")
        private String email;

        @Size(min = 6, message = "A senha deve ter pelo menos 6 caracteres.")
        private String senha;

        @AssertTrue(message = "Para criar sua conta, aceite os Termos de Uso e a Política de Privacidade.")
        private boolean aceitouTermos;
    }

    @Data
    public static class LoginRequest {
        @NotBlank(message = "Informe seu e-mail.")
        @Email(message = "Informe um e-mail válido.")
        private String email;

        @NotBlank(message = "Informe sua senha.")
        private String senha;
    }

    @Data
    public static class GoogleLoginRequest {
        @NotBlank(message = "Não foi possível validar a conta Google.")
        private String credential;
    }

    @Data
    public static class GoogleCodeLoginRequest {
        @NotBlank(message = "Não foi possível validar o login com Google.")
        private String code;

        @NotBlank(message = "Não foi possível validar a origem do login com Google.")
        private String redirectUri;

        private Boolean aceitouTermos;
        private Boolean modoCadastro;
    }

    @Data
    public static class CompleteGoogleSignupRequest {
        @NotBlank(message = "Nao foi possivel continuar o cadastro com Google.")
        private String signupToken;

        @AssertTrue(message = "Para concluir sua conta, aceite os Termos de Uso e a Politica de Privacidade.")
        private boolean aceitouTermos;
    }

    @Data
    public static class ForgotPasswordRequest {
        @NotBlank(message = "Informe seu e-mail.")
        @Email(message = "Informe um e-mail válido.")
        private String email;
    }

    @Data
    public static class ResetPasswordRequest {
        @NotBlank(message = "Informe o token de redefinição.")
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
        private String email;
        private String role;
        private String provider;
        private String status;
        private String pendingSignupToken;

        public LoginResponse(String token, String nome, Usuario.Role role, Usuario.AuthProvider provider) {
            this.token = token;
            this.nome = nome;
            this.email = null;
            this.role = role.name();
            this.provider = provider.name();
            this.status = "AUTHENTICATED";
        }

        public LoginResponse() {
        }

        public static LoginResponse pendingGoogleSignup(String nome, String email, String pendingSignupToken) {
            LoginResponse response = new LoginResponse();
            response.nome = nome;
            response.email = email;
            response.provider = Usuario.AuthProvider.GOOGLE.name();
            response.status = "PENDING_CONSENT";
            response.pendingSignupToken = pendingSignupToken;
            return response;
        }
    }
}
