package com.edupercurso.controller;

import com.edupercurso.dto.AssinaturaDTO;
import com.edupercurso.service.AssinaturaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AssinaturaDTO.Response> detalhar(@PathVariable UUID id) {
        return ResponseEntity.ok(assinaturaService.detalhar(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AssinaturaDTO.Response> criar(@Valid @RequestBody AssinaturaDTO.CreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(assinaturaService.criarManual(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AssinaturaDTO.Response> atualizar(
            @PathVariable UUID id,
            @Valid @RequestBody AssinaturaDTO.UpdateRequest request) {
        return ResponseEntity.ok(assinaturaService.atualizar(id, request));
    }

    @PostMapping("/{id}/prorrogar")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AssinaturaDTO.Response> prorrogar(
            @PathVariable UUID id,
            @Valid @RequestBody AssinaturaDTO.ExtendRequest request) {
        return ResponseEntity.ok(assinaturaService.prorrogar(id, request));
    }

    @PostMapping("/{id}/cancelar")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AssinaturaDTO.Response> cancelar(
            @AuthenticationPrincipal String email,
            @PathVariable UUID id,
            @RequestBody(required = false) AssinaturaDTO.CancelRequest request) {
        return ResponseEntity.ok(assinaturaService.cancelar(id, email, request));
    }
}
