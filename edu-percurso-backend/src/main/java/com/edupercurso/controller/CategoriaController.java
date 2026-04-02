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
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/categorias")
@RequiredArgsConstructor
public class CategoriaController {

    private final CategoriaRepository categoriaRepository;

    @GetMapping
    public ResponseEntity<List<Categoria>> listar() {
        return ResponseEntity.ok(categoriaRepository.findAllByOrderByOrdemExibicaoAscNomeAsc());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Categoria> criar(@Valid @RequestBody CategoriaRequest req) {
        Categoria categoria = Categoria.builder()
                .nome(req.getNome())
                .descricao(req.getDescricao())
                .ordemExibicao(resolverOrdemExibicao(req.getOrdemExibicao()))
                .build();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(categoriaRepository.save(categoria));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Categoria> atualizar(@PathVariable UUID id, @Valid @RequestBody CategoriaRequest req) {
        Categoria categoria = categoriaRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Categoria nao encontrada."));

        categoria.setNome(req.getNome());
        categoria.setDescricao(req.getDescricao());
        categoria.setOrdemExibicao(resolverOrdemExibicao(req.getOrdemExibicao()));

        return ResponseEntity.ok(categoriaRepository.save(categoria));
    }

    private Integer resolverOrdemExibicao(Integer ordemExibicao) {
        if (ordemExibicao != null) {
            return Math.max(0, ordemExibicao);
        }

        return categoriaRepository.findTopByOrderByOrdemExibicaoDesc()
                .map(Categoria::getOrdemExibicao)
                .orElse(0) + 1;
    }

    @Data
    public static class CategoriaRequest {
        @NotBlank private String nome;
        private String descricao;
        private Integer ordemExibicao;
    }
}
