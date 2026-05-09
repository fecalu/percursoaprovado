package com.edupercurso.controller;

import com.edupercurso.dto.DuvidaPercursoDTO;
import com.edupercurso.entity.DuvidaPercurso;
import com.edupercurso.service.DuvidaPercursoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/admin/duvidas-percurso")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminDuvidaPercursoController {

    private final DuvidaPercursoService duvidaPercursoService;

    @GetMapping
    public ResponseEntity<List<DuvidaPercursoDTO.Response>> listar(
            @RequestParam(required = false) UUID percursoId,
            @RequestParam(required = false) UUID localProvaId,
            @RequestParam(required = false) DuvidaPercurso.Status status,
            @RequestParam(required = false) String busca
    ) {
        return ResponseEntity.ok(duvidaPercursoService.listarAdmin(percursoId, localProvaId, status, busca));
    }

    @PutMapping("/{duvidaId}")
    public ResponseEntity<DuvidaPercursoDTO.Response> atualizar(
            @AuthenticationPrincipal String email,
            @PathVariable UUID duvidaId,
            @Valid @RequestBody DuvidaPercursoDTO.AdminUpdateRequest request
    ) {
        return ResponseEntity.ok(duvidaPercursoService.atualizarAdmin(email, duvidaId, request));
    }

    @DeleteMapping("/{duvidaId}")
    public ResponseEntity<Void> excluir(@PathVariable UUID duvidaId) {
        duvidaPercursoService.excluirAdmin(duvidaId);
        return ResponseEntity.noContent().build();
    }
}
