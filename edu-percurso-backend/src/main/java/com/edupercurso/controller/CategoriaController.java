package com.edupercurso.controller;

import com.edupercurso.entity.Categoria;
import com.edupercurso.entity.Percurso;
import com.edupercurso.repository.CategoriaRepository;
import com.edupercurso.repository.PercursoRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/categorias")
@RequiredArgsConstructor
public class CategoriaController {

    private final CategoriaRepository categoriaRepository;
    private final PercursoRepository percursoRepository;

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

    @PostMapping("/{id}/mover-aulas")
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> moverAulas(@PathVariable UUID id, @Valid @RequestBody MoverAulasRequest req) {
        Categoria categoriaOrigem = categoriaRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Categoria de origem nao encontrada."));
        Categoria categoriaDestino = categoriaRepository.findById(req.getCategoriaDestinoId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Categoria de destino nao encontrada."));

        if (categoriaOrigem.getId().equals(categoriaDestino.getId())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "erro", "Escolha um modulo diferente para mover as aulas."
            ));
        }

        List<Percurso> percursos = percursoRepository.findByCategoriaId(categoriaOrigem.getId());
        percursos.forEach(percurso -> percurso.setCategoria(categoriaDestino));
        percursoRepository.saveAll(percursos);

        return ResponseEntity.ok(Map.of(
                "totalAulasMovidas", percursos.size(),
                "categoriaOrigemId", categoriaOrigem.getId(),
                "categoriaOrigemNome", categoriaOrigem.getNome(),
                "categoriaDestinoId", categoriaDestino.getId(),
                "categoriaDestinoNome", categoriaDestino.getNome()
        ));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> excluir(@PathVariable UUID id) {
        Categoria categoria = categoriaRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Categoria nao encontrada."));

        long totalAulasVinculadas = percursoRepository.countByCategoriaId(id);
        if (totalAulasVinculadas > 0) {
            String plural = totalAulasVinculadas == 1 ? "" : "s";
            String mensagem = "Nao e possivel excluir este modulo porque ele ainda esta vinculado a "
                    + totalAulasVinculadas
                    + " aula"
                    + plural
                    + ". Remova ou troque o modulo dessas aulas antes de excluir.";

            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(java.util.Map.of("erro", mensagem));
        }

        categoriaRepository.delete(categoria);
        return ResponseEntity.noContent().build();
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

    @Data
    public static class MoverAulasRequest {
        @NotNull private UUID categoriaDestinoId;
    }
}
