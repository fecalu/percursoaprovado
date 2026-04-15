package com.edupercurso.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class MediaCleanupService {

    private static final List<String> MEDIA_REFERENCE_QUERIES = List.of(
            "select count(*) from locais_prova where imagem_principal_url = ?",
            "select count(*) from locais_prova where imagem_card_url = ?",
            "select count(*) from percursos where thumbnail_url = ?",
            "select count(*) from pontos_atencao_percurso where imagem_url = ?",
            "select count(*) from pontos_atencao_percurso where audio_url = ?",
            "select count(*) from questoes_teoricas where imagem_url = ?",
            "select count(*) from questao_alternativas where imagem_url = ?",
            "select count(*) from categoria_guia_blocos where imagem_url = ?",
            "select count(*) from categoria_guia_itens where imagem_url = ?"
    );

    private final JdbcTemplate jdbcTemplate;
    private final StorageService storageService;

    public void excluirArquivosOrfaos(Collection<String> urls) {
        if (urls == null || urls.isEmpty()) {
            return;
        }

        normalizarUrls(urls).forEach(this::excluirSeOrfao);
    }

    private void excluirSeOrfao(String url) {
        if (estaReferenciado(url)) {
            return;
        }

        storageService.excluirArquivoPorUrl(url);
    }

    private boolean estaReferenciado(String url) {
        return MEDIA_REFERENCE_QUERIES.stream()
                .mapToLong(query -> {
                    Long total = jdbcTemplate.queryForObject(query, Long.class, url);
                    return total == null ? 0L : total;
                })
                .sum() > 0;
    }

    private Set<String> normalizarUrls(Collection<String> urls) {
        Set<String> normalized = new LinkedHashSet<>();

        for (String url : urls) {
            if (!StringUtils.hasText(url)) {
                continue;
            }

            String trimmed = url.trim();
            if (!storageService.isManagedMediaUrl(trimmed)) {
                continue;
            }

            normalized.add(trimmed);
        }

        return normalized;
    }
}
