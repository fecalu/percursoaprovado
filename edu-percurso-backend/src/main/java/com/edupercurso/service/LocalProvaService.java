package com.edupercurso.service;

import com.edupercurso.dto.LocalProvaDTO;
import com.edupercurso.entity.LocalProva;
import com.edupercurso.repository.LocalProvaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LocalProvaService {

    private static final Set<LocalProva.StatusComercial> STATUS_PUBLICOS = Set.of(
            LocalProva.StatusComercial.EM_BREVE,
            LocalProva.StatusComercial.DISPONIVEL,
            LocalProva.StatusComercial.PAUSADO
    );

    private final LocalProvaRepository localProvaRepository;

    public List<LocalProvaDTO.Response> listar(boolean todos) {
        List<LocalProva> locais = (todos
                ? localProvaRepository.findAllByOrderByOrdemExibicaoAscNomeAsc()
                : localProvaRepository.findByAtivoTrueOrderByOrdemExibicaoAscNomeAsc())
                .stream()
                .filter(local -> todos || STATUS_PUBLICOS.contains(local.getStatusComercial()))
                .toList();

        return locais.stream()
                .map(LocalProvaDTO.Response::from)
                .toList();
    }

    public LocalProvaDTO.Response buscarPorSlug(String slug, boolean admin) {
        LocalProva localProva = buscarEntidadePorSlug(slug);
        if (!admin && !podeExibirPublicamente(localProva)) {
            throw new IllegalArgumentException("Local de prova nao encontrado.");
        }
        return LocalProvaDTO.Response.from(localProva);
    }

    @Transactional
    public LocalProvaDTO.Response criar(LocalProvaDTO.Request request) {
        LocalProva localProva = LocalProva.builder()
                .nome(request.getNome().trim())
                .slug(resolverSlug(request.getSlug(), request.getNome()))
                .descricao(request.getDescricao())
                .cidade(request.getCidade() == null || request.getCidade().isBlank() ? "Sao Luis" : request.getCidade().trim())
                .ativo(request.isAtivo())
                .statusComercial(normalizarStatusComercial(request.getStatusComercial()))
                .mensagemPublica(normalizarTexto(request.getMensagemPublica()))
                .ordemExibicao(request.getOrdemExibicao() == null ? 0 : request.getOrdemExibicao())
                .build();

        validarSlugUnico(localProva.getSlug(), null);
        return LocalProvaDTO.Response.from(localProvaRepository.save(localProva));
    }

    @Transactional
    public LocalProvaDTO.Response atualizar(UUID id, LocalProvaDTO.Request request) {
        LocalProva localProva = buscarEntidadePorId(id);
        String slug = resolverSlug(request.getSlug(), request.getNome());
        validarSlugUnico(slug, id);

        localProva.setNome(request.getNome().trim());
        localProva.setSlug(slug);
        localProva.setDescricao(request.getDescricao());
        localProva.setCidade(request.getCidade() == null || request.getCidade().isBlank() ? "Sao Luis" : request.getCidade().trim());
        localProva.setAtivo(request.isAtivo());
        localProva.setStatusComercial(normalizarStatusComercial(request.getStatusComercial()));
        localProva.setMensagemPublica(normalizarTexto(request.getMensagemPublica()));
        localProva.setOrdemExibicao(request.getOrdemExibicao() == null ? 0 : request.getOrdemExibicao());

        return LocalProvaDTO.Response.from(localProvaRepository.save(localProva));
    }

    @Transactional
    public void excluir(UUID id) {
        if (!localProvaRepository.existsById(id)) {
            throw new IllegalArgumentException("Local de prova nao encontrado.");
        }
        localProvaRepository.deleteById(id);
    }

    public LocalProva buscarEntidadePorId(UUID id) {
        return localProvaRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Local de prova nao encontrado."));
    }

    public LocalProva buscarEntidadePorSlug(String slug) {
        return localProvaRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalArgumentException("Local de prova nao encontrado."));
    }

    public boolean podeExibirPublicamente(LocalProva localProva) {
        return localProva.isAtivo() && STATUS_PUBLICOS.contains(localProva.getStatusComercial());
    }

    public boolean permiteCompra(LocalProva localProva) {
        return localProva.isAtivo() && localProva.getStatusComercial() == LocalProva.StatusComercial.DISPONIVEL;
    }

    private void validarSlugUnico(String slug, UUID idAtual) {
        localProvaRepository.findBySlug(slug).ifPresent(existente -> {
            if (idAtual == null || !existente.getId().equals(idAtual)) {
                throw new IllegalArgumentException("Ja existe um local de prova com esse slug.");
            }
        });
    }

    private String resolverSlug(String slug, String nome) {
        String base = (slug != null && !slug.isBlank()) ? slug : nome;
        String normalized = Normalizer.normalize(base, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        String slugValue = normalized
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");

        if (slugValue.isBlank()) {
            throw new IllegalArgumentException("Nao foi possivel gerar o slug do local de prova.");
        }
        return slugValue;
    }

    private LocalProva.StatusComercial normalizarStatusComercial(String statusComercial) {
        if (!StringUtils.hasText(statusComercial)) {
            return LocalProva.StatusComercial.RASCUNHO;
        }

        try {
            return LocalProva.StatusComercial.valueOf(statusComercial.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Status comercial invalido.");
        }
    }

    private String normalizarTexto(String valor) {
        return StringUtils.hasText(valor) ? valor.trim() : null;
    }
}
