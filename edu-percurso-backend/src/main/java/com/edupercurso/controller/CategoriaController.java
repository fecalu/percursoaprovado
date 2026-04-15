package com.edupercurso.controller;

import com.edupercurso.dto.PercursoDTO;
import com.edupercurso.entity.Categoria;
import com.edupercurso.entity.CategoriaGuiaBloco;
import com.edupercurso.entity.CategoriaGuiaItem;
import com.edupercurso.entity.Percurso;
import com.edupercurso.repository.CategoriaRepository;
import com.edupercurso.repository.PercursoRepository;
import com.edupercurso.service.AssinaturaService;
import com.edupercurso.service.MediaCleanupService;
import com.edupercurso.service.PercursoService;
import com.edupercurso.service.UsuarioLookupService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/categorias")
@RequiredArgsConstructor
public class CategoriaController {

    private final CategoriaRepository categoriaRepository;
    private final PercursoRepository percursoRepository;
    private final MediaCleanupService mediaCleanupService;
    private final PercursoService percursoService;
    private final UsuarioLookupService usuarioLookupService;
    private final AssinaturaService assinaturaService;

    @GetMapping
    public ResponseEntity<List<Categoria>> listar(
            @AuthenticationPrincipal String email,
            Authentication authentication) {
        List<Categoria> categorias = categoriaRepository.findAllByOrderByOrdemExibicaoAscNomeAsc();

        if (ehAdmin(authentication)) {
            return ResponseEntity.ok(categorias);
        }

        if (email == null || email.isBlank()) {
            return ResponseEntity.ok(List.of());
        }

        var usuario = usuarioLookupService.buscarPorEmail(email);
        if (!assinaturaService.possuiQualquerAssinaturaAtiva(usuario.getId())) {
            return ResponseEntity.ok(List.of());
        }

        Set<UUID> categoriaIdsVisiveis = percursoService.listar(email, false, false, null, null, null).stream()
                .map(PercursoDTO.Response::getCategoriaId)
                .filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());

        return ResponseEntity.ok(categorias.stream()
                .filter(categoria -> categoriaIdsVisiveis.contains(categoria.getId()))
                .toList());
    }

    @PostMapping
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Categoria> criar(@Valid @RequestBody CategoriaRequest req) {
        Categoria categoria = Categoria.builder()
                .nome(req.getNome())
                .descricao(req.getDescricao())
                .ordemExibicao(resolverOrdemExibicao(req.getOrdemExibicao()))
                .formatoExperiencia(resolverFormatoExperiencia(req.getFormatoExperiencia()))
                .build();
        aplicarGuiaBlocos(categoria, req.getGuiaBlocos());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(categoriaRepository.save(categoria));
    }

    @PutMapping("/{id}")
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Categoria> atualizar(@PathVariable UUID id, @Valid @RequestBody CategoriaRequest req) {
        Categoria categoria = categoriaRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Categoria nao encontrada."));
        Set<String> midiasAnteriores = coletarMidiasDoGuia(categoria);

        categoria.setNome(req.getNome());
        categoria.setDescricao(req.getDescricao());
        categoria.setOrdemExibicao(resolverOrdemExibicao(req.getOrdemExibicao()));
        categoria.setFormatoExperiencia(resolverFormatoExperiencia(req.getFormatoExperiencia()));
        aplicarGuiaBlocos(categoria, req.getGuiaBlocos());

        Categoria categoriaSalva = categoriaRepository.save(categoria);
        categoriaRepository.flush();
        agendarLimpezaDeMidias(calcularMidiasRemovidas(midiasAnteriores, coletarMidiasDoGuia(categoriaSalva)));

        return ResponseEntity.ok(categoriaSalva);
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
        Set<String> midiasDoGuia = coletarMidiasDoGuia(categoria);

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
        categoriaRepository.flush();
        agendarLimpezaDeMidias(midiasDoGuia);
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

    private Categoria.FormatoExperiencia resolverFormatoExperiencia(String formatoExperiencia) {
        if (formatoExperiencia == null || formatoExperiencia.isBlank()) {
            return Categoria.FormatoExperiencia.AULAS;
        }

        try {
            return Categoria.FormatoExperiencia.valueOf(formatoExperiencia.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Formato de modulo invalido.");
        }
    }

    private void aplicarGuiaBlocos(Categoria categoria, List<GuiaBlocoRequest> blocos) {
        categoria.getGuiaBlocos().clear();

        if (blocos == null || blocos.isEmpty()) {
            return;
        }

        blocos.stream()
                .filter(bloco -> bloco.getTitulo() != null && !bloco.getTitulo().isBlank())
                .forEach(bloco -> {
                    CategoriaGuiaBloco guiaBloco = CategoriaGuiaBloco.builder()
                        .categoria(categoria)
                        .titulo(bloco.getTitulo().trim())
                        .descricao(bloco.getDescricao() == null || bloco.getDescricao().isBlank() ? null : bloco.getDescricao().trim())
                        .textoDetalhado(bloco.getTextoDetalhado() == null || bloco.getTextoDetalhado().isBlank() ? null : bloco.getTextoDetalhado().trim())
                        .imagemUrl(bloco.getImagemUrl() == null || bloco.getImagemUrl().isBlank() ? null : bloco.getImagemUrl().trim())
                        .imagemLegenda(bloco.getImagemLegenda() == null || bloco.getImagemLegenda().isBlank() ? null : bloco.getImagemLegenda().trim())
                        .icone(bloco.getIcone() == null || bloco.getIcone().isBlank() ? null : bloco.getIcone().trim())
                        .ordemExibicao(resolverOrdemExibicaoGuia(bloco.getOrdemExibicao()))
                        .build();
                    guiaBloco.substituirItensVisuais(prepararItensVisuais(bloco.getItensVisuais()));
                    categoria.getGuiaBlocos().add(guiaBloco);
                });
    }

    private Integer resolverOrdemExibicaoGuia(Integer ordemExibicao) {
        return Math.max(0, ordemExibicao == null ? 0 : ordemExibicao);
    }

    private Set<String> coletarMidiasDoGuia(Categoria categoria) {
        Set<String> urls = new LinkedHashSet<>();

        if (categoria == null || categoria.getGuiaBlocos() == null) {
            return urls;
        }

        categoria.getGuiaBlocos().forEach(bloco -> {
            if (bloco == null) {
                return;
            }

            adicionarUrlSePresente(urls, bloco.getImagemUrl());

            if (bloco.getItensVisuais() == null) {
                return;
            }

            bloco.getItensVisuais().forEach(item -> adicionarUrlSePresente(urls, item.getImagemUrl()));
        });

        return urls;
    }

    private Set<String> calcularMidiasRemovidas(Set<String> antigas, Set<String> atuais) {
        Set<String> removidas = new LinkedHashSet<>(antigas);
        removidas.removeAll(atuais);
        return removidas;
    }

    private void adicionarUrlSePresente(Set<String> urls, String url) {
        if (url != null && !url.isBlank()) {
            urls.add(url.trim());
        }
    }

    private void agendarLimpezaDeMidias(Set<String> urls) {
        if (urls == null || urls.isEmpty()) {
            return;
        }

        Set<String> urlsParaLimpeza = Set.copyOf(urls);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                mediaCleanupService.excluirArquivosOrfaos(urlsParaLimpeza);
            }
        });
    }

    private boolean ehAdmin(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }

    private List<CategoriaGuiaItem> prepararItensVisuais(List<GuiaItemVisualRequest> itens) {
        if (itens == null || itens.isEmpty()) {
            return List.of();
        }

        return itens.stream()
                .filter(item -> item.getTitulo() != null && !item.getTitulo().isBlank())
                .map(item -> CategoriaGuiaItem.builder()
                        .titulo(item.getTitulo().trim())
                        .descricao(item.getDescricao() == null || item.getDescricao().isBlank() ? null : item.getDescricao().trim())
                        .imagemUrl(item.getImagemUrl() == null || item.getImagemUrl().isBlank() ? null : item.getImagemUrl().trim())
                        .imagemLegenda(item.getImagemLegenda() == null || item.getImagemLegenda().isBlank() ? null : item.getImagemLegenda().trim())
                        .ordemExibicao(resolverOrdemExibicaoGuia(item.getOrdemExibicao()))
                        .build())
                .toList();
    }

    @Data
    public static class CategoriaRequest {
        @NotBlank private String nome;
        private String descricao;
        private Integer ordemExibicao;
        private String formatoExperiencia;
        private List<GuiaBlocoRequest> guiaBlocos;
    }

    @Data
    public static class GuiaBlocoRequest {
        private String titulo;
        private String descricao;
        private String textoDetalhado;
        private String imagemUrl;
        private String imagemLegenda;
        private String icone;
        private Integer ordemExibicao;
        private List<GuiaItemVisualRequest> itensVisuais;
    }

    @Data
    public static class GuiaItemVisualRequest {
        private String titulo;
        private String descricao;
        private String imagemUrl;
        private String imagemLegenda;
        private Integer ordemExibicao;
    }

    @Data
    public static class MoverAulasRequest {
        @NotNull private UUID categoriaDestinoId;
    }
}
