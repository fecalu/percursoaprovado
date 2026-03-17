package com.edupercurso.service;

import com.edupercurso.dto.PercursoDTO;
import com.edupercurso.entity.Categoria;
import com.edupercurso.entity.LocalProva;
import com.edupercurso.entity.Percurso;
import com.edupercurso.entity.Usuario;
import com.edupercurso.repository.CategoriaRepository;
import com.edupercurso.repository.PercursoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PercursoService {

    private final PercursoRepository percursoRepository;
    private final CategoriaRepository categoriaRepository;
    private final LocalProvaService localProvaService;
    private final UsuarioLookupService usuarioLookupService;
    private final AssinaturaService assinaturaService;
    private final AcessoConteudoService acessoConteudoService;

    public List<PercursoDTO.Response> listar(String email,
                                             boolean admin,
                                             boolean todos,
                                             String localSlug,
                                             Percurso.TipoConteudo tipoConteudo,
                                             Boolean geral) {
        List<Percurso> percursos = admin && todos
                ? percursoRepository.findAll()
                : percursoRepository.findByAtivoTrue();

        Usuario usuario = admin ? null : usuarioLookupService.buscarPorEmail(email);
        Set<UUID> locaisAtivos = admin ? Set.of() : assinaturaService.listarLocaisAtivos(usuario.getId());
        boolean possuiQualquerAssinaturaAtiva = admin || !locaisAtivos.isEmpty();

        return percursos.stream()
                .filter(percurso -> filtrarPorLocal(percurso, localSlug, geral))
                .filter(percurso -> tipoConteudo == null || percurso.getTipoConteudo() == tipoConteudo)
                .filter(percurso -> admin || podeAcessarNaListagem(percurso, locaisAtivos, possuiQualquerAssinaturaAtiva))
                .sorted(Comparator
                        .comparing(Percurso::getOrdemExibicao, Comparator.nullsLast(Integer::compareTo))
                        .thenComparing(Percurso::getCriadoEm, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(PercursoDTO.Response::from)
                .toList();
    }

    public PercursoDTO.Response buscarPorId(String email, boolean admin, UUID id) {
        Percurso percurso = buscarEntidadePorId(id);
        if (!admin) {
            Usuario usuario = usuarioLookupService.buscarPorEmail(email);
            acessoConteudoService.validarAcesso(usuario, percurso);
        }
        return PercursoDTO.Response.from(percurso);
    }

    @Transactional
    public PercursoDTO.Response criar(PercursoDTO.Request request) {
        Percurso percurso = Percurso.builder()
                .titulo(request.getTitulo())
                .descricao(request.getDescricao())
                .videoUrl(request.getVideoUrl())
                .duracaoSegundos(request.getDuracaoSegundos())
                .ativo(request.isAtivo())
                .categoria(resolverCategoria(request.getCategoriaId()))
                .localProva(resolverLocalProva(request.getLocalProvaId()))
                .tipoConteudo(request.getTipoConteudo() == null ? Percurso.TipoConteudo.PERCURSO_REAL : request.getTipoConteudo())
                .resumo(request.getResumo())
                .thumbnailUrl(request.getThumbnailUrl())
                .ordemExibicao(request.getOrdemExibicao() == null ? 0 : request.getOrdemExibicao())
                .destaque(request.isDestaque())
                .build();

        return PercursoDTO.Response.from(percursoRepository.save(percurso));
    }

    @Transactional
    public PercursoDTO.Response atualizar(UUID id, PercursoDTO.Request request) {
        Percurso percurso = buscarEntidadePorId(id);

        percurso.setTitulo(request.getTitulo());
        percurso.setDescricao(request.getDescricao());
        percurso.setVideoUrl(request.getVideoUrl());
        percurso.setDuracaoSegundos(request.getDuracaoSegundos());
        percurso.setAtivo(request.isAtivo());
        percurso.setCategoria(resolverCategoria(request.getCategoriaId()));
        percurso.setLocalProva(resolverLocalProva(request.getLocalProvaId()));
        percurso.setTipoConteudo(request.getTipoConteudo() == null ? Percurso.TipoConteudo.PERCURSO_REAL : request.getTipoConteudo());
        percurso.setResumo(request.getResumo());
        percurso.setThumbnailUrl(request.getThumbnailUrl());
        percurso.setOrdemExibicao(request.getOrdemExibicao() == null ? 0 : request.getOrdemExibicao());
        percurso.setDestaque(request.isDestaque());

        return PercursoDTO.Response.from(percursoRepository.save(percurso));
    }

    @Transactional
    public void excluir(UUID id) {
        if (!percursoRepository.existsById(id)) {
            throw new IllegalArgumentException("Conteudo nao encontrado.");
        }
        percursoRepository.deleteById(id);
    }

    public Percurso buscarEntidadePorId(UUID id) {
        return percursoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Conteudo nao encontrado."));
    }

    private boolean filtrarPorLocal(Percurso percurso, String localSlug, Boolean geral) {
        if (Boolean.TRUE.equals(geral)) {
            return percurso.getLocalProva() == null;
        }
        if (Boolean.FALSE.equals(geral) && percurso.getLocalProva() == null) {
            return false;
        }
        if (localSlug == null || localSlug.isBlank()) {
            return true;
        }
        return percurso.getLocalProva() != null && localSlug.equalsIgnoreCase(percurso.getLocalProva().getSlug());
    }

    private boolean podeAcessarNaListagem(Percurso percurso, Set<UUID> locaisAtivos, boolean possuiQualquerAssinaturaAtiva) {
        if (!percurso.isAtivo()) {
            return false;
        }
        if (percurso.getLocalProva() == null) {
            return possuiQualquerAssinaturaAtiva;
        }
        return locaisAtivos.contains(percurso.getLocalProva().getId());
    }

    private Categoria resolverCategoria(UUID categoriaId) {
        if (categoriaId == null) {
            return null;
        }
        return categoriaRepository.findById(categoriaId)
                .orElseThrow(() -> new IllegalArgumentException("Categoria nao encontrada."));
    }

    private LocalProva resolverLocalProva(UUID localProvaId) {
        if (localProvaId == null) {
            return null;
        }
        return localProvaService.buscarEntidadePorId(localProvaId);
    }
}
