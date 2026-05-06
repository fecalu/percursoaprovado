package com.edupercurso.service;

import com.edupercurso.dto.AuthDTO;
import com.edupercurso.entity.Usuario;
import com.edupercurso.repository.UsuarioRepository;
import com.edupercurso.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final String JWT_SECRET = "0123456789012345678901234567890123456789012345678901234567890123";

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private PasswordResetService passwordResetService;

    @Mock
    private GoogleAuthService googleAuthService;

    @Test
    void loginComGoogleCodeRetornaPendenciaDeAceiteParaNovoCadastro() {
        AuthService authService = criarAuthService();
        GoogleAuthService.GoogleAccount googleAccount = new GoogleAuthService.GoogleAccount(
                "google-sub-1",
                "joao@example.com",
                "Joao Felipe",
                "https://example.com/avatar.png",
                true
        );
        AuthDTO.GoogleCodeLoginRequest request = new AuthDTO.GoogleCodeLoginRequest();
        request.setCode("code-123");
        request.setRedirectUri("https://percursoaprovado.com.br");
        request.setModoCadastro(true);
        request.setAceitouTermos(false);

        when(googleAuthService.trocarCodePorConta(any(), any(), any(), any())).thenReturn(googleAccount);
        when(usuarioRepository.findByGoogleSub(googleAccount.getGoogleSub())).thenReturn(Optional.empty());
        when(usuarioRepository.findByEmailIgnoreCase(googleAccount.getEmail())).thenReturn(Optional.empty());

        AuthDTO.LoginResponse response = authService.loginComGoogleCode(request, "https://percursoaprovado.com.br", "XMLHttpRequest");

        assertThat(response.getStatus()).isEqualTo("PENDING_CONSENT");
        assertThat(response.getPendingSignupToken()).isNotBlank();
        assertThat(response.getToken()).isNull();
        assertThat(response.getEmail()).isEqualTo("joao@example.com");
    }

    @Test
    void concluirCadastroGoogleCriaContaAoConfirmarAceite() {
        AuthService authService = criarAuthService();
        JwtUtil jwtUtil = criarJwtUtil();
        AuthDTO.CompleteGoogleSignupRequest request = new AuthDTO.CompleteGoogleSignupRequest();
        request.setAceitouTermos(true);
        request.setSignupToken(jwtUtil.gerarTokenCadastroGooglePendente(
                "google-sub-2",
                "novo@example.com",
                "Novo Aluno",
                "https://example.com/avatar.png",
                true
        ));

        when(usuarioRepository.findByGoogleSub("google-sub-2")).thenReturn(Optional.empty());
        when(usuarioRepository.findByEmailIgnoreCase("novo@example.com")).thenReturn(Optional.empty());
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(invocation -> {
            Usuario usuario = invocation.getArgument(0);
            usuario.setId(UUID.randomUUID());
            return usuario;
        });

        AuthDTO.LoginResponse response = authService.concluirCadastroGoogle(request);

        ArgumentCaptor<Usuario> captor = ArgumentCaptor.forClass(Usuario.class);
        verify(usuarioRepository).save(captor.capture());
        assertThat(captor.getValue().getAuthProvider()).isEqualTo(Usuario.AuthProvider.GOOGLE);
        assertThat(captor.getValue().getTermosAceitosEm()).isNotNull();
        assertThat(response.getStatus()).isEqualTo("AUTHENTICATED");
        assertThat(response.getToken()).isNotBlank();
    }

    private AuthService criarAuthService() {
        return new AuthService(
                usuarioRepository,
                passwordEncoder,
                criarJwtUtil(),
                passwordResetService,
                googleAuthService
        );
    }

    private JwtUtil criarJwtUtil() {
        return new JwtUtil(JWT_SECRET, 86400000L);
    }
}
