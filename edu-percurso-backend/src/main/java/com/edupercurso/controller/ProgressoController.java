package com.edupercurso.controller;

import com.edupercurso.dto.ProgressoDTO;
import com.edupercurso.service.ProgressoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/progresso")
@RequiredArgsConstructor
public class ProgressoController {

    private final ProgressoService progressoService;

    @GetMapping("/meu")
    public ResponseEntity<List<ProgressoDTO.Response>> meuProgresso(
            @AuthenticationPrincipal String email) {
        return ResponseEntity.ok(progressoService.listarMeuProgresso(email));
    }

    @PostMapping
    public ResponseEntity<ProgressoDTO.Response> salvar(
            @AuthenticationPrincipal String email,
            @Valid @RequestBody ProgressoDTO.Request req) {
        return ResponseEntity.ok(progressoService.salvar(email, req));
    }
}
