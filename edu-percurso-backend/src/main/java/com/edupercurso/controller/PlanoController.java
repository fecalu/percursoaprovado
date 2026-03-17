package com.edupercurso.controller;

import com.edupercurso.dto.PlanoDTO;
import com.edupercurso.service.PlanoService;
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
@RequestMapping("/planos")
@RequiredArgsConstructor
public class PlanoController {

    private final PlanoService planoService;

    @GetMapping
    public ResponseEntity<List<PlanoDTO.Response>> listar(
            Authentication authentication,
            @RequestParam(required = false) String localSlug,
            @RequestParam(defaultValue = "false") boolean todos) {
        return ResponseEntity.ok(planoService.listar(localSlug, ehAdmin(authentication) && todos));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PlanoDTO.Response> criar(@Valid @RequestBody PlanoDTO.Request request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(planoService.criar(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PlanoDTO.Response> atualizar(
            @PathVariable UUID id,
            @Valid @RequestBody PlanoDTO.Request request) {
        return ResponseEntity.ok(planoService.atualizar(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> excluir(@PathVariable UUID id) {
        planoService.excluir(id);
        return ResponseEntity.noContent().build();
    }

    private boolean ehAdmin(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }
}
