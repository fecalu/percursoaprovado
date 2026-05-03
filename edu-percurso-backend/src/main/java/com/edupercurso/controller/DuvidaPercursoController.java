package com.edupercurso.controller;

import com.edupercurso.dto.DuvidaPercursoDTO;
import com.edupercurso.service.DuvidaPercursoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/percursos/{percursoId}/duvidas")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ALUNO')")
public class DuvidaPercursoController {

    private final DuvidaPercursoService duvidaPercursoService;

    @GetMapping
    public ResponseEntity<List<DuvidaPercursoDTO.Response>> listar(
            @AuthenticationPrincipal String email,
            @PathVariable UUID percursoId
    ) {
        return ResponseEntity.ok(duvidaPercursoService.listarPublicas(email, percursoId));
    }

    @PostMapping
    public ResponseEntity<DuvidaPercursoDTO.Response> criar(
            @AuthenticationPrincipal String email,
            @PathVariable UUID percursoId,
            @Valid @RequestBody DuvidaPercursoDTO.CreateRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(duvidaPercursoService.criar(email, percursoId, request));
    }

    @PostMapping("/{duvidaId}/apoios")
    public ResponseEntity<Void> adicionarApoio(
            @AuthenticationPrincipal String email,
            @PathVariable UUID percursoId,
            @PathVariable UUID duvidaId
    ) {
        duvidaPercursoService.adicionarApoio(email, percursoId, duvidaId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{duvidaId}/apoios")
    public ResponseEntity<Void> removerApoio(
            @AuthenticationPrincipal String email,
            @PathVariable UUID percursoId,
            @PathVariable UUID duvidaId
    ) {
        duvidaPercursoService.removerApoio(email, percursoId, duvidaId);
        return ResponseEntity.noContent().build();
    }
}
