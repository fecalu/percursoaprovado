package com.edupercurso.controller;

import com.edupercurso.entity.Categoria;
import com.edupercurso.repository.CategoriaRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/categorias")
@RequiredArgsConstructor
public class CategoriaController {

    private final CategoriaRepository categoriaRepository;

    @GetMapping
    public ResponseEntity<List<Categoria>> listar() {
        return ResponseEntity.ok(categoriaRepository.findAll());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Categoria> criar(@Valid @RequestBody CategoriaRequest req) {
        Categoria categoria = Categoria.builder()
                .nome(req.getNome())
                .descricao(req.getDescricao())
                .build();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(categoriaRepository.save(categoria));
    }

    @Data
    public static class CategoriaRequest {
        @NotBlank private String nome;
        private String descricao;
    }
}
