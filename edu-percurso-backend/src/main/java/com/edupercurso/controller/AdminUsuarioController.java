package com.edupercurso.controller;

import com.edupercurso.dto.AdminUsuarioDTO;
import com.edupercurso.service.AdminUsuarioService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/usuarios")
@RequiredArgsConstructor
public class AdminUsuarioController {

    private final AdminUsuarioService adminUsuarioService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AdminUsuarioDTO.ListResponse> listarAlunos(
            @RequestParam(required = false, defaultValue = "") String busca
    ) {
        return ResponseEntity.ok(adminUsuarioService.listarAlunos(busca));
    }

    @PostMapping("/excluir-aluno-teste")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AdminUsuarioDTO.DeleteTestAlunoResponse> excluirAlunoTeste(
            @AuthenticationPrincipal String adminEmail,
            @Valid @RequestBody AdminUsuarioDTO.DeleteTestAlunoRequest request
    ) {
        return ResponseEntity.ok(adminUsuarioService.excluirAlunoTeste(request.getEmail(), adminEmail));
    }
}
