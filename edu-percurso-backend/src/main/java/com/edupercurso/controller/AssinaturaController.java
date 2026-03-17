package com.edupercurso.controller;

import com.edupercurso.dto.AssinaturaDTO;
import com.edupercurso.service.AssinaturaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/assinaturas")
@RequiredArgsConstructor
public class AssinaturaController {

    private final AssinaturaService assinaturaService;

    @GetMapping("/minhas")
    public ResponseEntity<List<AssinaturaDTO.Response>> minhas(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(assinaturaService.listarMinhas(email));
    }
}
