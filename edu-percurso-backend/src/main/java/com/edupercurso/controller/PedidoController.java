package com.edupercurso.controller;

import com.edupercurso.dto.PedidoDTO;
import com.edupercurso.service.PedidoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/pedidos")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ALUNO')")
public class PedidoController {

    private final PedidoService pedidoService;

    @GetMapping
    public ResponseEntity<List<PedidoDTO.Response>> listarMeus(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(pedidoService.listarMeus(email));
    }

    @PostMapping
    public ResponseEntity<PedidoDTO.Response> criar(
            @AuthenticationPrincipal String email,
            @Valid @RequestBody PedidoDTO.CreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(pedidoService.criarPedidoAluno(email, request));
    }

    @PostMapping("/sincronizar-retorno")
    public ResponseEntity<PedidoDTO.Response> sincronizarRetorno(
            @AuthenticationPrincipal String email,
            @Valid @RequestBody PedidoDTO.SyncRequest request) {
        return ResponseEntity.ok(pedidoService.sincronizarRetorno(email, request));
    }

    @PostMapping("/{id}/cancelar")
    public ResponseEntity<Void> cancelarMeu(
            @AuthenticationPrincipal String email,
            @PathVariable UUID id) {
        pedidoService.cancelarMeu(email, id);
        return ResponseEntity.noContent().build();
    }
}
