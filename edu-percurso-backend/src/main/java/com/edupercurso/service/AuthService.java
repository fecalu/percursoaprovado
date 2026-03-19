package com.edupercurso.service;

import com.edupercurso.dto.AuthDTO;
import com.edupercurso.entity.Usuario;
import com.edupercurso.repository.UsuarioRepository;
import com.edupercurso.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final PasswordResetService passwordResetService;

    public AuthDTO.LoginResponse registrar(AuthDTO.RegisterRequest req) {
        if (usuarioRepository.existsByEmail(req.getEmail())) {
            throw new IllegalArgumentException("E-mail ja cadastrado.");
        }

        Usuario usuario = Usuario.builder()
                .nome(req.getNome())
                .email(req.getEmail())
                .senhaHash(passwordEncoder.encode(req.getSenha()))
                .role(Usuario.Role.ALUNO)
                .build();

        usuarioRepository.save(usuario);

        String token = jwtUtil.gerar(usuario.getEmail(), usuario.getRole().name());
        return new AuthDTO.LoginResponse(token, usuario.getNome(), usuario.getRole());
    }

    public AuthDTO.LoginResponse login(AuthDTO.LoginRequest req) {
        Usuario usuario = usuarioRepository.findByEmail(req.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("Credenciais invalidas."));

        if (!passwordEncoder.matches(req.getSenha(), usuario.getSenhaHash())) {
            throw new IllegalArgumentException("Credenciais invalidas.");
        }

        String token = jwtUtil.gerar(usuario.getEmail(), usuario.getRole().name());
        return new AuthDTO.LoginResponse(token, usuario.getNome(), usuario.getRole());
    }

    public void solicitarRedefinicao(AuthDTO.ForgotPasswordRequest req) {
        passwordResetService.solicitarRedefinicao(req.getEmail());
    }

    public void redefinirSenha(AuthDTO.ResetPasswordRequest req) {
        passwordResetService.redefinirSenha(req.getToken(), req.getNovaSenha());
    }
}
