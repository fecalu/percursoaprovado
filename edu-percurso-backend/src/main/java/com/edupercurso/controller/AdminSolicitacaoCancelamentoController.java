package com.edupercurso.controller;

import com.edupercurso.dto.SolicitacaoCancelamentoDTO;
import com.edupercurso.service.SolicitacaoCancelamentoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/admin/cancelamentos")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminSolicitacaoCancelamentoController {

    private final SolicitacaoCancelamentoService solicitacaoCancelamentoService;

    @GetMapping
    public ResponseEntity<List<SolicitacaoCancelamentoDTO.Response>> listar() {
        return ResponseEntity.ok(solicitacaoCancelamentoService.listarTodas());
    }

    @PostMapping("/{id}/aprovar")
    public ResponseEntity<SolicitacaoCancelamentoDTO.Response> aprovar(
            @PathVariable UUID id,
            @AuthenticationPrincipal String email,
            @Valid @RequestBody(required = false) SolicitacaoCancelamentoDTO.ProcessRequest request) {
        return ResponseEntity.ok(solicitacaoCancelamentoService.aprovar(id, email, request));
    }

    @PostMapping("/{id}/negar")
    public ResponseEntity<SolicitacaoCancelamentoDTO.Response> negar(
            @PathVariable UUID id,
            @AuthenticationPrincipal String email,
            @Valid @RequestBody(required = false) SolicitacaoCancelamentoDTO.ProcessRequest request) {
        return ResponseEntity.ok(solicitacaoCancelamentoService.negar(id, email, request));
    }

    @PostMapping("/{id}/marcar-reembolsado")
    public ResponseEntity<SolicitacaoCancelamentoDTO.Response> marcarReembolsado(
            @PathVariable UUID id,
            @AuthenticationPrincipal String email,
            @Valid @RequestBody(required = false) SolicitacaoCancelamentoDTO.ProcessRequest request) {
        return ResponseEntity.ok(solicitacaoCancelamentoService.marcarReembolsado(id, email, request));
    }
}
