package com.edupercurso.controller;

import com.edupercurso.dto.QuestaoDTO;
import com.edupercurso.entity.QuestaoTeorica;
import com.edupercurso.service.QuestaoTeoricaService;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/admin/questoes")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminQuestaoController {

    private final QuestaoTeoricaService questaoTeoricaService;

    @GetMapping
    public ResponseEntity<List<QuestaoDTO.Response>> listar(
            @RequestParam(required = false) String busca,
            @RequestParam(required = false) QuestaoTeorica.Tema tema,
            @RequestParam(required = false) QuestaoTeorica.Status status) {
        return ResponseEntity.ok(questaoTeoricaService.listarAdmin(busca, tema, status));
    }

    @GetMapping("/{id}")
    public ResponseEntity<QuestaoDTO.Response> buscar(@PathVariable UUID id) {
        return ResponseEntity.ok(questaoTeoricaService.buscarAdmin(id));
    }

    @PostMapping
    public ResponseEntity<QuestaoDTO.Response> criar(@Valid @RequestBody QuestaoDTO.Request request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(questaoTeoricaService.criar(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<QuestaoDTO.Response> atualizar(
            @PathVariable UUID id,
            @Valid @RequestBody QuestaoDTO.Request request) {
        return ResponseEntity.ok(questaoTeoricaService.atualizar(id, request));
    }

    @PostMapping("/{id}/publicar")
    public ResponseEntity<QuestaoDTO.Response> publicar(@PathVariable UUID id) {
        return ResponseEntity.ok(questaoTeoricaService.publicar(id));
    }

    @PostMapping("/{id}/arquivar")
    public ResponseEntity<QuestaoDTO.Response> arquivar(@PathVariable UUID id) {
        return ResponseEntity.ok(questaoTeoricaService.arquivar(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable UUID id) {
        questaoTeoricaService.excluir(id);
        return ResponseEntity.noContent().build();
    }
}
