package com.edupercurso.controller;

import com.edupercurso.dto.AuthDTO;
import com.edupercurso.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<AuthDTO.LoginResponse> registrar(@Valid @RequestBody AuthDTO.RegisterRequest req) {
        return ResponseEntity.ok(authService.registrar(req));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthDTO.LoginResponse> login(@Valid @RequestBody AuthDTO.LoginRequest req) {
        return ResponseEntity.ok(authService.login(req));
    }

    @PostMapping("/google")
    public ResponseEntity<AuthDTO.LoginResponse> loginComGoogle(@Valid @RequestBody AuthDTO.GoogleLoginRequest req) {
        return ResponseEntity.ok(authService.loginComGoogle(req));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<AuthDTO.MessageResponse> forgotPassword(@Valid @RequestBody AuthDTO.ForgotPasswordRequest req) {
        authService.solicitarRedefinicao(req);
        return ResponseEntity.ok(new AuthDTO.MessageResponse(
                "Se esse e-mail estiver cadastrado, enviaremos as instrucoes para redefinir sua senha."
        ));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<AuthDTO.MessageResponse> resetPassword(@Valid @RequestBody AuthDTO.ResetPasswordRequest req) {
        authService.redefinirSenha(req);
        return ResponseEntity.ok(new AuthDTO.MessageResponse("Senha atualizada com sucesso."));
    }
}
