package com.edupercurso.controller;

import com.edupercurso.dto.AssinaturaDTO;
import com.edupercurso.service.AssinaturaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/admin/assinaturas")
@RequiredArgsConstructor
public class AdminAssinaturaController {

    private final AssinaturaService assinaturaService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<java.util.List<AssinaturaDTO.Response>> listar() {
        return ResponseEntity.ok(assinaturaService.listarTodas());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AssinaturaDTO.Response> criar(@Valid @RequestBody AssinaturaDTO.CreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(assinaturaService.criarManual(request));
    }

    @PostMapping("/{id}/cancelar")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> cancelar(@PathVariable UUID id) {
        assinaturaService.cancelar(id);
        return ResponseEntity.noContent().build();
    }
}
