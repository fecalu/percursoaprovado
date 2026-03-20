package com.edupercurso.service;

import com.edupercurso.dto.PercursoDTO;
import com.edupercurso.entity.Categoria;
import com.edupercurso.entity.LocalProva;
import com.edupercurso.entity.Percurso;
import com.edupercurso.entity.PontoAtencaoPercurso;
import com.edupercurso.entity.Usuario;
import com.edupercurso.repository.CategoriaRepository;
import com.edupercurso.repository.PercursoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PercursoService {

    @Value("${app.video.bunny.library-id:}")
    private String bunnyLibraryId;

    private final PercursoRepository percursoRepository;
    private final CategoriaRepository categoriaRepository;
    private final LocalProvaService localProvaService;
    private final UsuarioLookupService usuarioLookupService;
    private final AssinaturaService assinaturaService;
    private final AcessoConteudoService acessoConteudoService;

    @Transactional(readOnly = true)
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

    @Transactional(readOnly = true)
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
        Percurso.VideoProvider videoProvider = resolverVideoProvider(request);
        Percurso percurso = Percurso.builder()
                .titulo(request.getTitulo())
                .descricao(request.getDescricao())
                .videoUrl(resolverVideoUrl(request, videoProvider))
                .videoProvider(videoProvider)
                .videoAssetId(resolverVideoAssetId(request, videoProvider))
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
        percurso.substituirPontosAtencao(montarPontosAtencao(request.getPontosAtencao()));

        return PercursoDTO.Response.from(percursoRepository.save(percurso));
    }

    @Transactional
    public PercursoDTO.Response atualizar(UUID id, PercursoDTO.Request request) {
        Percurso percurso = buscarEntidadePorId(id);
        Percurso.VideoProvider videoProvider = resolverVideoProvider(request);

        percurso.setTitulo(request.getTitulo());
        percurso.setDescricao(request.getDescricao());
        percurso.setVideoUrl(resolverVideoUrl(request, videoProvider));
        percurso.setVideoProvider(videoProvider);
        percurso.setVideoAssetId(resolverVideoAssetId(request, videoProvider));
        percurso.setDuracaoSegundos(request.getDuracaoSegundos());
        percurso.setAtivo(request.isAtivo());
        percurso.setCategoria(resolverCategoria(request.getCategoriaId()));
        percurso.setLocalProva(resolverLocalProva(request.getLocalProvaId()));
        percurso.setTipoConteudo(request.getTipoConteudo() == null ? Percurso.TipoConteudo.PERCURSO_REAL : request.getTipoConteudo());
        percurso.setResumo(request.getResumo());
        percurso.setThumbnailUrl(request.getThumbnailUrl());
        percurso.setOrdemExibicao(request.getOrdemExibicao() == null ? 0 : request.getOrdemExibicao());
        percurso.setDestaque(request.isDestaque());
        percurso.substituirPontosAtencao(montarPontosAtencao(request.getPontosAtencao()));

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

    private List<PontoAtencaoPercurso> montarPontosAtencao(List<PercursoDTO.PontoAtencaoRequest> pontos) {
        if (pontos == null) {
            return List.of();
        }

        validarPontosAtencao(pontos);

        return pontos.stream()
                .map(item -> PontoAtencaoPercurso.builder()
                        .timestampSegundos(item.getTimestampSegundos())
                        .titulo(item.getTitulo().trim())
                        .descricaoCurta(normalizarTexto(item.getDescricaoCurta()))
                        .descricaoDetalhada(normalizarTexto(item.getDescricaoDetalhada()))
                        .tipo(item.getTipo() == null ? PontoAtencaoPercurso.Tipo.DICA_IMPORTANTE : item.getTipo())
                        .imagemUrl(normalizarTexto(item.getImagemUrl()))
                        .videoUrl(normalizarTexto(item.getVideoUrl()))
                        .modoExibicao(item.getModoExibicao() == null ? PontoAtencaoPercurso.ModoExibicao.CLIQUE : item.getModoExibicao())
                        .ordemExibicao(item.getOrdemExibicao() == null ? 0 : item.getOrdemExibicao())
                        .ativo(item.isAtivo())
                        .build())
                .toList();
    }

    private void validarPontosAtencao(List<PercursoDTO.PontoAtencaoRequest> pontos) {
        for (PercursoDTO.PontoAtencaoRequest ponto : pontos) {
            if (ponto.getTimestampSegundos() == null || ponto.getTimestampSegundos() < 0) {
                throw new IllegalArgumentException("Cada ponto de atencao precisa ter um tempo valido.");
            }

            if (ponto.getTitulo() == null || ponto.getTitulo().trim().isBlank()) {
                throw new IllegalArgumentException("Cada ponto de atencao precisa ter um titulo.");
            }
        }
    }

    private String normalizarTexto(String valor) {
        if (valor == null) {
            return null;
        }

        String texto = valor.trim();
        return texto.isBlank() ? null : texto;
    }

    private Percurso.VideoProvider resolverVideoProvider(PercursoDTO.Request request) {
        if (request.getVideoProvider() != null) {
            return request.getVideoProvider();
        }

        String videoUrl = normalizarTexto(request.getVideoUrl());
        if (videoUrl == null) {
            return Percurso.VideoProvider.YOUTUBE;
        }

        if (videoUrl.contains("mediadelivery.net/embed/") || videoUrl.contains("video.bunnycdn.com")) {
            return Percurso.VideoProvider.BUNNY;
        }
        if (videoUrl.contains("vimeo.com")) {
            return Percurso.VideoProvider.VIMEO;
        }
        return Percurso.VideoProvider.YOUTUBE;
    }

    private String resolverVideoUrl(PercursoDTO.Request request, Percurso.VideoProvider videoProvider) {
        String videoUrl = normalizarTexto(request.getVideoUrl());

        if (videoProvider == Percurso.VideoProvider.BUNNY) {
            String videoAssetId = resolverVideoAssetId(request, videoProvider);

            if (videoUrl != null) {
                return videoUrl;
            }
            if (videoAssetId == null) {
                throw new IllegalArgumentException("Informe o video do Bunny pelo ID ou pela URL de embed.");
            }
            if (bunnyLibraryId == null || bunnyLibraryId.isBlank()) {
                throw new IllegalArgumentException("BUNNY_STREAM_LIBRARY_ID nao configurado no servidor.");
            }

            return "https://iframe.mediadelivery.net/embed/" + bunnyLibraryId.trim() + "/" + videoAssetId;
        }

        if (videoUrl == null) {
            throw new IllegalArgumentException("A URL do video e obrigatoria para esse provedor.");
        }

        return videoUrl;
    }

    private String resolverVideoAssetId(PercursoDTO.Request request, Percurso.VideoProvider videoProvider) {
        if (videoProvider != Percurso.VideoProvider.BUNNY) {
            return null;
        }

        String videoAssetId = normalizarTexto(request.getVideoAssetId());
        if (videoAssetId != null) {
            return videoAssetId;
        }

        return extrairBunnyVideoAssetId(request.getVideoUrl());
    }

    private String extrairBunnyVideoAssetId(String videoUrl) {
        String valor = normalizarTexto(videoUrl);
        if (valor == null) {
            return null;
        }

        String[] partes = valor.split("/");
        if (partes.length == 0) {
            return null;
        }

        String ultimaParte = partes[partes.length - 1].trim();
        return ultimaParte.isBlank() ? null : ultimaParte;
    }
}
