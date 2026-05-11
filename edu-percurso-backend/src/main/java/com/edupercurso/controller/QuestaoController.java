package com.edupercurso.controller;

import com.edupercurso.dto.QuestaoAlunoDTO;
import com.edupercurso.entity.QuestaoTeorica;
import com.edupercurso.service.QuestaoTeoricaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/questoes")
@RequiredArgsConstructor
public class QuestaoController {

    private final QuestaoTeoricaService questaoTeoricaService;

    @GetMapping("/temas")
    public ResponseEntity<List<QuestaoAlunoDTO.TemaResumoResponse>> listarTemas(
            @RequestParam(required = false) QuestaoTeorica.Modalidade modalidade) {
        return ResponseEntity.ok(questaoTeoricaService.listarTemasDisponiveis(modalidade));
    }

    @GetMapping("/treino")
    public ResponseEntity<List<QuestaoAlunoDTO.QuestaoTreinoResponse>> listarTreino(
            @RequestParam(required = false) QuestaoTeorica.Modalidade modalidade,
            @RequestParam(required = false) QuestaoTeorica.Tema tema) {
        return ResponseEntity.ok(questaoTeoricaService.listarTreino(modalidade, tema));
    }

    @GetMapping("/simulado-completo")
    public ResponseEntity<List<QuestaoAlunoDTO.QuestaoTreinoResponse>> listarSimuladoCompleto(
            @RequestParam(required = false) QuestaoTeorica.Modalidade modalidade,
            @RequestParam(required = false) List<UUID> excluirIds) {
        return ResponseEntity.ok(questaoTeoricaService.listarSimuladoCompleto(modalidade, excluirIds));
    }

    @PostMapping("/{id}/responder")
    public ResponseEntity<QuestaoAlunoDTO.ResponderResponse> responder(
            @AuthenticationPrincipal String email,
            @PathVariable UUID id,
            @Valid @RequestBody QuestaoAlunoDTO.ResponderRequest request) {
        return ResponseEntity.ok(questaoTeoricaService.responder(email, id, request));
    }
}
