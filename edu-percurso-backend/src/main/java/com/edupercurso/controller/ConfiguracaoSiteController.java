package com.edupercurso.controller;

import com.edupercurso.dto.ConfiguracaoSiteDTO;
import com.edupercurso.service.ConfiguracaoSiteService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class ConfiguracaoSiteController {

    private final ConfiguracaoSiteService configuracaoSiteService;

    @GetMapping("/configuracoes-site")
    public ResponseEntity<ConfiguracaoSiteDTO.Response> buscarPublica() {
        return ResponseEntity.ok(configuracaoSiteService.buscarPublica());
    }

    @GetMapping("/admin/configuracoes-site")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ConfiguracaoSiteDTO.Response> buscarAdmin() {
        return ResponseEntity.ok(configuracaoSiteService.buscarAdmin());
    }

    @PutMapping("/admin/configuracoes-site/home")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ConfiguracaoSiteDTO.Response> atualizarHome(
            @RequestBody ConfiguracaoSiteDTO.HomeConfig request) {
        return ResponseEntity.ok(configuracaoSiteService.atualizarHome(request));
    }

    @PutMapping("/admin/configuracoes-site/local-page")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ConfiguracaoSiteDTO.Response> atualizarLocalPage(
            @RequestBody ConfiguracaoSiteDTO.LocalPageConfig request) {
        return ResponseEntity.ok(configuracaoSiteService.atualizarLocalPage(request));
    }

    @PutMapping("/admin/configuracoes-site/checkout")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ConfiguracaoSiteDTO.Response> atualizarCheckout(
            @RequestBody ConfiguracaoSiteDTO.CheckoutConfig request) {
        return ResponseEntity.ok(configuracaoSiteService.atualizarCheckout(request));
    }
}
