package com.edupercurso.controller;

import com.edupercurso.dto.TrilhaDTO;
import com.edupercurso.service.TrilhaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class TrilhaController {

    private final TrilhaService trilhaService;

    @GetMapping("/trilhas")
    public ResponseEntity<List<TrilhaDTO.Response>> listarPublicas() {
        return ResponseEntity.ok(trilhaService.listar(true).stream()
                .map(TrilhaDTO.Response::from)
                .toList());
    }

    @GetMapping("/admin/trilhas")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<TrilhaDTO.Response>> listarAdmin() {
        return ResponseEntity.ok(trilhaService.listar(false).stream()
                .map(TrilhaDTO.Response::from)
                .toList());
    }

    @PostMapping("/admin/trilhas")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<TrilhaDTO.Response> criar(@Valid @RequestBody TrilhaDTO.Request request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(TrilhaDTO.Response.from(trilhaService.criar(request)));
    }

    @PutMapping("/admin/trilhas/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<TrilhaDTO.Response> atualizar(
            @PathVariable UUID id,
            @Valid @RequestBody TrilhaDTO.Request request) {
        return ResponseEntity.ok(TrilhaDTO.Response.from(trilhaService.atualizar(id, request)));
    }

    @DeleteMapping("/admin/trilhas/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> excluir(@PathVariable UUID id) {
        trilhaService.excluir(id);
        return ResponseEntity.noContent().build();
    }
}
