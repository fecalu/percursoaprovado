package com.edupercurso.controller;

import com.edupercurso.dto.LocalProvaDTO;
import com.edupercurso.service.LocalProvaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/locais-prova")
@RequiredArgsConstructor
public class LocalProvaController {

    private final LocalProvaService localProvaService;

    @GetMapping
    public ResponseEntity<List<LocalProvaDTO.Response>> listar(
            Authentication authentication,
            @RequestParam(defaultValue = "false") boolean todos) {
        return ResponseEntity.ok(localProvaService.listar(ehAdmin(authentication) && todos));
    }

    @GetMapping("/{slug}")
    public ResponseEntity<LocalProvaDTO.Response> buscar(@PathVariable String slug) {
        return ResponseEntity.ok(localProvaService.buscarPorSlug(slug));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<LocalProvaDTO.Response> criar(@Valid @RequestBody LocalProvaDTO.Request request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(localProvaService.criar(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<LocalProvaDTO.Response> atualizar(
            @PathVariable UUID id,
            @Valid @RequestBody LocalProvaDTO.Request request) {
        return ResponseEntity.ok(localProvaService.atualizar(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> excluir(@PathVariable UUID id) {
        localProvaService.excluir(id);
        return ResponseEntity.noContent().build();
    }

    private boolean ehAdmin(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }
}
