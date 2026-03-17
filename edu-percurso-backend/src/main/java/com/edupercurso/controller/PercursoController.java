package com.edupercurso.controller;

import com.edupercurso.dto.PercursoDTO;
import com.edupercurso.entity.Percurso;
import com.edupercurso.service.PercursoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/percursos")
@RequiredArgsConstructor
public class PercursoController {

    private final PercursoService percursoService;

    @GetMapping
    public ResponseEntity<List<PercursoDTO.Response>> listar(
            @AuthenticationPrincipal String email,
            Authentication authentication,
            @RequestParam(defaultValue = "false") boolean todos,
            @RequestParam(required = false) String localSlug,
            @RequestParam(required = false) Percurso.TipoConteudo tipo,
            @RequestParam(required = false) Boolean geral) {
        return ResponseEntity.ok(percursoService.listar(
                email,
                ehAdmin(authentication),
                todos,
                localSlug,
                tipo,
                geral
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PercursoDTO.Response> buscar(
            @AuthenticationPrincipal String email,
            Authentication authentication,
            @PathVariable UUID id) {
        return ResponseEntity.ok(percursoService.buscarPorId(email, ehAdmin(authentication), id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PercursoDTO.Response> criar(@Valid @RequestBody PercursoDTO.Request request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(percursoService.criar(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PercursoDTO.Response> atualizar(
            @PathVariable UUID id,
            @Valid @RequestBody PercursoDTO.Request request) {
        return ResponseEntity.ok(percursoService.atualizar(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> excluir(@PathVariable UUID id) {
        percursoService.excluir(id);
        return ResponseEntity.noContent().build();
    }

    private boolean ehAdmin(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }
}
