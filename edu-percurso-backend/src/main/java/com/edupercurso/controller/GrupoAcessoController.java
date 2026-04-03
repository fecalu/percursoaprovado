package com.edupercurso.controller;

import com.edupercurso.dto.GrupoAcessoDTO;
import com.edupercurso.service.GrupoAcessoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/admin/grupos-acesso")
@RequiredArgsConstructor
public class GrupoAcessoController {

    private final GrupoAcessoService grupoAcessoService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<GrupoAcessoDTO.Response>> listar() {
        return ResponseEntity.ok(grupoAcessoService.listar().stream()
                .map(GrupoAcessoDTO.Response::from)
                .toList());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<GrupoAcessoDTO.Response> criar(@Valid @RequestBody GrupoAcessoDTO.Request request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(GrupoAcessoDTO.Response.from(grupoAcessoService.criar(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<GrupoAcessoDTO.Response> atualizar(
            @PathVariable UUID id,
            @Valid @RequestBody GrupoAcessoDTO.Request request) {
        return ResponseEntity.ok(GrupoAcessoDTO.Response.from(grupoAcessoService.atualizar(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> excluir(@PathVariable UUID id) {
        grupoAcessoService.excluir(id);
        return ResponseEntity.noContent().build();
    }
}
