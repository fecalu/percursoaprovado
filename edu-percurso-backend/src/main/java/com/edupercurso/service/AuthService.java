package com.edupercurso.service;

import com.edupercurso.dto.AuthDTO;
import com.edupercurso.entity.Usuario;
import com.edupercurso.repository.UsuarioRepository;
import com.edupercurso.security.JwtUtil;
import io.jsonwebtoken.JwtException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final PasswordResetService passwordResetService;
    private final GoogleAuthService googleAuthService;

    public AuthDTO.LoginResponse registrar(AuthDTO.RegisterRequest req) {
        String email = normalizarEmail(req.getEmail());
        String nome = normalizarNome(req.getNome());
        LocalDateTime aceiteEm = LocalDateTime.now();

        Usuario usuarioExistente = usuarioRepository.findByEmailIgnoreCase(email).orElse(null);
        if (usuarioExistente != null) {
            if (usuarioExistente.getAuthProvider() == Usuario.AuthProvider.GOOGLE) {
                throw new IllegalArgumentException("Esse e-mail já foi cadastrado com Google. Use Continuar com Google.");
            }
            throw new IllegalArgumentException("E-mail já cadastrado.");
        }

        Usuario usuario = Usuario.builder()
                .nome(nome)
                .email(email)
                .senhaHash(passwordEncoder.encode(req.getSenha()))
                .authProvider(Usuario.AuthProvider.LOCAL)
                .emailVerificado(false)
                .termosAceitosEm(aceiteEm)
                .politicaPrivacidadeAceitaEm(aceiteEm)
                .role(Usuario.Role.ALUNO)
                .build();

        usuarioRepository.save(usuario);

        return criarRespostaLogin(usuario);
    }

    public AuthDTO.LoginResponse login(AuthDTO.LoginRequest req) {
        String email = normalizarEmail(req.getEmail());

        Usuario usuario = usuarioRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new IllegalArgumentException("Credenciais inválidas."));

        if (usuario.getAuthProvider() == Usuario.AuthProvider.GOOGLE || usuario.getSenhaHash() == null || usuario.getSenhaHash().isBlank()) {
            throw new IllegalArgumentException("Essa conta usa Google. Entre com Continuar com Google.");
        }

        if (!passwordEncoder.matches(req.getSenha(), usuario.getSenhaHash())) {
            throw new IllegalArgumentException("Credenciais inválidas.");
        }

        return criarRespostaLogin(usuario);
    }

    public AuthDTO.LoginResponse loginComGoogle(AuthDTO.GoogleLoginRequest req) {
        GoogleAuthService.GoogleAccount googleAccount = googleAuthService.validarCredential(req.getCredential());
        return loginOuRegistrarContaGoogle(googleAccount, false, false);
    }

    public AuthDTO.LoginResponse loginComGoogleCode(
            AuthDTO.GoogleCodeLoginRequest req,
            String originHeader,
            String requestedWith
    ) {
        GoogleAuthService.GoogleAccount googleAccount = googleAuthService.trocarCodePorConta(
                req.getCode(),
                req.getRedirectUri(),
                originHeader,
                requestedWith
        );
        return loginOuRegistrarContaGoogle(
                googleAccount,
                Boolean.TRUE.equals(req.getAceitouTermos()),
                Boolean.TRUE.equals(req.getModoCadastro())
        );
    }

    public AuthDTO.LoginResponse concluirCadastroGoogle(AuthDTO.CompleteGoogleSignupRequest req) {
        JwtUtil.GoogleSignupPending signupPending;
        try {
            signupPending = jwtUtil.extrairTokenCadastroGooglePendente(req.getSignupToken());
        } catch (JwtException | IllegalArgumentException error) {
            throw new IllegalArgumentException("Nao foi possivel continuar o cadastro com Google. Tente novamente.");
        }

        return criarOuEntrarContaGooglePendente(signupPending);
    }

    private AuthDTO.LoginResponse loginOuRegistrarContaGoogle(
            GoogleAuthService.GoogleAccount googleAccount,
            boolean aceitouTermos,
            boolean modoCadastro
    ) {
        Usuario usuarioVinculado = usuarioRepository.findByGoogleSub(googleAccount.getGoogleSub()).orElse(null);
        if (usuarioVinculado != null) {
            if (usuarioVinculado.getRole() != Usuario.Role.ALUNO) {
                throw new IllegalArgumentException("Login com Google não disponível para essa conta.");
            }

            boolean precisaAtualizar = false;
            if (!googleAccount.getNome().equals(usuarioVinculado.getNome())) {
                usuarioVinculado.setNome(googleAccount.getNome());
                precisaAtualizar = true;
            }
            if (!googleAccount.getEmail().equalsIgnoreCase(usuarioVinculado.getEmail())
                    && usuarioRepository.findByEmailIgnoreCase(googleAccount.getEmail())
                    .filter(outro -> !outro.getId().equals(usuarioVinculado.getId()))
                    .isPresent()) {
                throw new IllegalArgumentException("Já existe outra conta vinculada a esse e-mail.");
            }
            if (!googleAccount.getEmail().equalsIgnoreCase(usuarioVinculado.getEmail())) {
                usuarioVinculado.setEmail(googleAccount.getEmail());
                precisaAtualizar = true;
            }
            if (googleAccount.getAvatarUrl() != null && !googleAccount.getAvatarUrl().equals(usuarioVinculado.getAvatarUrl())) {
                usuarioVinculado.setAvatarUrl(googleAccount.getAvatarUrl());
                precisaAtualizar = true;
            }
            if (usuarioVinculado.isEmailVerificado() != googleAccount.isEmailVerificado()) {
                usuarioVinculado.setEmailVerificado(googleAccount.isEmailVerificado());
                precisaAtualizar = true;
            }
            if (usuarioVinculado.getAuthProvider() != Usuario.AuthProvider.GOOGLE) {
                usuarioVinculado.setAuthProvider(Usuario.AuthProvider.GOOGLE);
                precisaAtualizar = true;
            }

            if (precisaAtualizar) {
                usuarioRepository.save(usuarioVinculado);
            }

            return criarRespostaLogin(usuarioVinculado);
        }

        Usuario usuarioComMesmoEmail = usuarioRepository.findByEmailIgnoreCase(googleAccount.getEmail()).orElse(null);
        if (usuarioComMesmoEmail != null) {
            throw new IllegalArgumentException("Já existe uma conta com esse e-mail. Entre com sua senha para acessar.");
        }
        if (!modoCadastro) {
            throw new IllegalArgumentException("Não encontramos uma conta vinculada a este Google. Toque em Criar conta para continuar.");
        }
        if (!aceitouTermos) {
            String pendingSignupToken = jwtUtil.gerarTokenCadastroGooglePendente(
                    googleAccount.getGoogleSub(),
                    googleAccount.getEmail(),
                    googleAccount.getNome(),
                    googleAccount.getAvatarUrl(),
                    googleAccount.isEmailVerificado()
            );
            return AuthDTO.LoginResponse.pendingGoogleSignup(
                    googleAccount.getNome(),
                    googleAccount.getEmail(),
                    pendingSignupToken
            );
        }

        return criarOuEntrarContaGooglePendente(new JwtUtil.GoogleSignupPending(
                googleAccount.getGoogleSub(),
                googleAccount.getEmail(),
                googleAccount.getNome(),
                googleAccount.getAvatarUrl(),
                googleAccount.isEmailVerificado()
        ));
    }

    public void solicitarRedefinicao(AuthDTO.ForgotPasswordRequest req) {
        passwordResetService.solicitarRedefinicao(req.getEmail());
    }

    public void redefinirSenha(AuthDTO.ResetPasswordRequest req) {
        passwordResetService.redefinirSenha(req.getToken(), req.getNovaSenha());
    }

    private AuthDTO.LoginResponse criarRespostaLogin(Usuario usuario) {
        String token = jwtUtil.gerar(usuario.getEmail(), usuario.getRole().name());
        return new AuthDTO.LoginResponse(token, usuario.getNome(), usuario.getRole(), usuario.getAuthProvider());
    }

    private AuthDTO.LoginResponse criarOuEntrarContaGooglePendente(JwtUtil.GoogleSignupPending signupPending) {
        Usuario usuarioVinculado = usuarioRepository.findByGoogleSub(signupPending.googleSub()).orElse(null);
        if (usuarioVinculado != null) {
            if (usuarioVinculado.getRole() != Usuario.Role.ALUNO) {
                throw new IllegalArgumentException("Login com Google nao disponivel para essa conta.");
            }

            sincronizarContaGoogle(usuarioVinculado, signupPending);
            return criarRespostaLogin(usuarioVinculado);
        }

        Usuario usuarioComMesmoEmail = usuarioRepository.findByEmailIgnoreCase(signupPending.email()).orElse(null);
        if (usuarioComMesmoEmail != null) {
            if (usuarioComMesmoEmail.getAuthProvider() == Usuario.AuthProvider.GOOGLE) {
                throw new IllegalArgumentException("Essa conta Google ja foi criada. Toque em Continuar com Google para entrar.");
            }
            throw new IllegalArgumentException("Ja existe uma conta com esse e-mail. Entre com sua senha para acessar.");
        }

        LocalDateTime aceiteEm = LocalDateTime.now();
        Usuario novoUsuario = Usuario.builder()
                .nome(signupPending.nome())
                .email(signupPending.email())
                .senhaHash(null)
                .authProvider(Usuario.AuthProvider.GOOGLE)
                .googleSub(signupPending.googleSub())
                .avatarUrl(signupPending.avatarUrl())
                .emailVerificado(signupPending.emailVerificado())
                .termosAceitosEm(aceiteEm)
                .politicaPrivacidadeAceitaEm(aceiteEm)
                .role(Usuario.Role.ALUNO)
                .build();

        usuarioRepository.save(novoUsuario);
        return criarRespostaLogin(novoUsuario);
    }

    private void sincronizarContaGoogle(Usuario usuario, JwtUtil.GoogleSignupPending signupPending) {
        boolean precisaAtualizar = false;

        if (!signupPending.nome().equals(usuario.getNome())) {
            usuario.setNome(signupPending.nome());
            precisaAtualizar = true;
        }
        if (!signupPending.email().equalsIgnoreCase(usuario.getEmail())
                && usuarioRepository.findByEmailIgnoreCase(signupPending.email())
                .filter(outro -> !outro.getId().equals(usuario.getId()))
                .isPresent()) {
            throw new IllegalArgumentException("Ja existe outra conta vinculada a esse e-mail.");
        }
        if (!signupPending.email().equalsIgnoreCase(usuario.getEmail())) {
            usuario.setEmail(signupPending.email());
            precisaAtualizar = true;
        }
        if (signupPending.avatarUrl() != null && !signupPending.avatarUrl().equals(usuario.getAvatarUrl())) {
            usuario.setAvatarUrl(signupPending.avatarUrl());
            precisaAtualizar = true;
        }
        if (usuario.isEmailVerificado() != signupPending.emailVerificado()) {
            usuario.setEmailVerificado(signupPending.emailVerificado());
            precisaAtualizar = true;
        }
        if (usuario.getAuthProvider() != Usuario.AuthProvider.GOOGLE) {
            usuario.setAuthProvider(Usuario.AuthProvider.GOOGLE);
            precisaAtualizar = true;
        }

        if (precisaAtualizar) {
            usuarioRepository.save(usuario);
        }
    }

    private String normalizarEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizarNome(String nome) {
        return nome == null ? "" : nome.trim().replaceAll("\\s+", " ");
    }
}
