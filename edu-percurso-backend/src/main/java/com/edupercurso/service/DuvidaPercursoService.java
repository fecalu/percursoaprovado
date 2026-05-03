package com.edupercurso.service;

import com.edupercurso.dto.DuvidaPercursoDTO;
import com.edupercurso.entity.DuvidaPercurso;
import com.edupercurso.entity.DuvidaPercursoApoio;
import com.edupercurso.entity.Percurso;
import com.edupercurso.entity.Usuario;
import com.edupercurso.repository.DuvidaPercursoApoioRepository;
import com.edupercurso.repository.DuvidaPercursoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class DuvidaPercursoService {

    private static final int JANELA_RELACIONADA_SEGUNDOS_PADRAO = 15;
    private static final Set<DuvidaPercurso.Status> STATUS_PUBLICOS = EnumSet.of(
            DuvidaPercurso.Status.PUBLICADA,
            DuvidaPercurso.Status.RESPONDIDA,
            DuvidaPercurso.Status.RESOLVIDA
    );

    private final DuvidaPercursoRepository duvidaPercursoRepository;
    private final DuvidaPercursoApoioRepository duvidaPercursoApoioRepository;
    private final PercursoService percursoService;
    private final UsuarioLookupService usuarioLookupService;
    private final AcessoConteudoService acessoConteudoService;

    @Transactional(readOnly = true)
    public List<DuvidaPercursoDTO.Response> listarPublicas(String email, UUID percursoId) {
        Usuario usuario = usuarioLookupService.buscarPorEmail(email);
        Percurso percurso = percursoService.buscarEntidadePorId(percursoId);
        acessoConteudoService.validarAcesso(usuario, percurso);

        List<DuvidaPercurso> duvidas = duvidaPercursoRepository.findByPercursoIdAndStatusIn(percursoId, STATUS_PUBLICOS);
        return montarResponses(duvidas, usuario.getId(), true);
    }

    @Transactional
    public DuvidaPercursoDTO.Response criar(String email, UUID percursoId, DuvidaPercursoDTO.CreateRequest request) {
        Usuario usuario = usuarioLookupService.buscarPorEmail(email);
        Percurso percurso = percursoService.buscarEntidadePorId(percursoId);
        acessoConteudoService.validarAcesso(usuario, percurso);
        validarTimestamp(request.getTimestampSegundos(), percurso);

        DuvidaPercurso duvida = DuvidaPercurso.builder()
                .percurso(percurso)
                .usuario(usuario)
                .timestampSegundos(request.getTimestampSegundos())
                .titulo(normalizarTitulo(request.getTitulo()))
                .descricao(normalizarTexto(request.getDescricao()))
                .status(DuvidaPercurso.Status.PENDENTE_MODERACAO)
                .build();

        return DuvidaPercursoDTO.Response.from(duvidaPercursoRepository.save(duvida), 0, false, JANELA_RELACIONADA_SEGUNDOS_PADRAO);
    }

    @Transactional
    public void adicionarApoio(String email, UUID percursoId, UUID duvidaId) {
        Usuario usuario = usuarioLookupService.buscarPorEmail(email);
        DuvidaPercurso duvida = buscarEntidade(duvidaId);
        validarMesmaOrigem(percursoId, duvida);
        acessoConteudoService.validarAcesso(usuario, duvida.getPercurso());
        validarDuvidaPublicaParaAluno(duvida);

        if (duvidaPercursoApoioRepository.existsByDuvidaIdAndUsuarioId(duvidaId, usuario.getId())) {
            return;
        }

        DuvidaPercursoApoio apoio = DuvidaPercursoApoio.builder()
                .duvida(duvida)
                .usuario(usuario)
                .build();
        duvidaPercursoApoioRepository.save(apoio);
    }

    @Transactional
    public void removerApoio(String email, UUID percursoId, UUID duvidaId) {
        Usuario usuario = usuarioLookupService.buscarPorEmail(email);
        DuvidaPercurso duvida = buscarEntidade(duvidaId);
        validarMesmaOrigem(percursoId, duvida);
        acessoConteudoService.validarAcesso(usuario, duvida.getPercurso());
        validarDuvidaPublicaParaAluno(duvida);
        duvidaPercursoApoioRepository.deleteByDuvidaIdAndUsuarioId(duvidaId, usuario.getId());
    }

    @Transactional(readOnly = true)
    public List<DuvidaPercursoDTO.Response> listarAdmin(UUID percursoId, UUID localProvaId, DuvidaPercurso.Status status, String busca) {
        List<DuvidaPercurso> duvidas = duvidaPercursoRepository.findAll();
        String termoBusca = busca == null ? "" : busca.trim().toLowerCase(Locale.ROOT);

        return montarResponses(duvidas, null, false).stream()
                .filter(item -> percursoId == null || percursoId.equals(item.getPercursoId()))
                .filter(item -> localProvaId == null || localProvaId.equals(item.getLocalProvaId()))
                .filter(item -> status == null || status.name().equals(item.getStatus()))
                .filter(item -> {
                    if (termoBusca.isBlank()) return true;
                    String base = String.join(" ",
                            Optional.ofNullable(item.getAutorNome()).orElse(""),
                            Optional.ofNullable(item.getPercursoTitulo()).orElse(""),
                            Optional.ofNullable(item.getLocalProvaNome()).orElse(""),
                            Optional.ofNullable(item.getTitulo()).orElse(""),
                            Optional.ofNullable(item.getDescricao()).orElse("")
                    ).toLowerCase(Locale.ROOT);
                    return base.contains(termoBusca);
                })
                .sorted(Comparator
                        .comparing(DuvidaPercursoDTO.Response::getCriadaEm, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(DuvidaPercursoDTO.Response::getTimestampSegundos, Comparator.nullsLast(Integer::compareTo)))
                .toList();
    }

    @Transactional
    public DuvidaPercursoDTO.Response atualizarAdmin(String adminEmail, UUID duvidaId, DuvidaPercursoDTO.AdminUpdateRequest request) {
        Usuario admin = usuarioLookupService.buscarPorEmail(adminEmail);
        DuvidaPercurso duvida = buscarEntidade(duvidaId);
        validarTimestamp(request.getTimestampSegundos(), duvida.getPercurso());

        String titulo = normalizarTitulo(request.getTitulo());
        String descricao = normalizarTexto(request.getDescricao());
        String respostaOficial = normalizarTexto(request.getRespostaOficial());
        DuvidaPercurso.Status status = request.getStatus();

        if ((status == DuvidaPercurso.Status.RESPONDIDA || status == DuvidaPercurso.Status.RESOLVIDA) && respostaOficial == null) {
            throw new IllegalArgumentException("Informe a resposta oficial para marcar a duvida como respondida.");
        }

        if (respostaOficial != null && status == DuvidaPercurso.Status.PUBLICADA) {
            status = DuvidaPercurso.Status.RESPONDIDA;
        }

        duvida.setTimestampSegundos(request.getTimestampSegundos());
        duvida.setTitulo(titulo);
        duvida.setDescricao(descricao);
        duvida.setStatus(status);
        duvida.setRespostaOficial(respostaOficial);

        if (status == DuvidaPercurso.Status.PUBLICADA
                || status == DuvidaPercurso.Status.RESPONDIDA
                || status == DuvidaPercurso.Status.RESOLVIDA) {
            if (duvida.getPublicadaEm() == null) {
                duvida.setPublicadaEm(LocalDateTime.now());
            }
        }

        if (respostaOficial != null) {
            duvida.setRespondidaPor(admin);
            if (duvida.getRespostaCriadaEm() == null) {
                duvida.setRespostaCriadaEm(LocalDateTime.now());
            }
        } else {
            duvida.setRespondidaPor(null);
            duvida.setRespostaCriadaEm(null);
        }

        DuvidaPercurso salva = duvidaPercursoRepository.save(duvida);
        long quantidadeApoios = contarApoiosPorDuvidaIds(List.of(salva.getId())).getOrDefault(salva.getId(), 0L);
        return DuvidaPercursoDTO.Response.from(
                salva,
                quantidadeApoios,
                false,
                normalizarJanelaRelacionada(request.getJanelaRelacionadaSegundos())
        );
    }

    private List<DuvidaPercursoDTO.Response> montarResponses(List<DuvidaPercurso> duvidas, UUID usuarioId, boolean ordenarPorRelevancia) {
        if (duvidas.isEmpty()) {
            return List.of();
        }

        List<UUID> duvidaIds = duvidas.stream().map(DuvidaPercurso::getId).toList();
        Map<UUID, Long> apoiosPorDuvida = contarApoiosPorDuvidaIds(duvidaIds);
        Set<UUID> duvidasApoiadas = usuarioId == null
                ? Set.of()
                : new HashSet<>(duvidaPercursoApoioRepository.listarDuvidaIdsApoiadasPorUsuario(usuarioId, duvidaIds));

        Stream<DuvidaPercurso> stream = duvidas.stream();
        if (ordenarPorRelevancia) {
            stream = stream.sorted(Comparator
                    .comparingLong((DuvidaPercurso item) -> apoiosPorDuvida.getOrDefault(item.getId(), 0L)).reversed()
                    .thenComparing(DuvidaPercurso::getTimestampSegundos, Comparator.nullsLast(Integer::compareTo))
                    .thenComparing(DuvidaPercurso::getCriadaEm, Comparator.nullsLast(Comparator.reverseOrder())));
        }

        return stream
                .map(duvida -> DuvidaPercursoDTO.Response.from(
                        duvida,
                        apoiosPorDuvida.getOrDefault(duvida.getId(), 0L),
                        duvidasApoiadas.contains(duvida.getId()),
                        JANELA_RELACIONADA_SEGUNDOS_PADRAO
                ))
                .toList();
    }

    private Map<UUID, Long> contarApoiosPorDuvidaIds(List<UUID> duvidaIds) {
        if (duvidaIds.isEmpty()) {
            return Map.of();
        }

        Map<UUID, Long> resultado = new HashMap<>();
        for (Object[] item : duvidaPercursoApoioRepository.contarPorDuvidaIds(duvidaIds)) {
            resultado.put((UUID) item[0], (Long) item[1]);
        }
        return resultado;
    }

    private void validarDuvidaPublicaParaAluno(DuvidaPercurso duvida) {
        if (!STATUS_PUBLICOS.contains(duvida.getStatus())) {
            throw new IllegalArgumentException("Essa duvida ainda nao esta disponivel para interacao.");
        }
    }

    private void validarMesmaOrigem(UUID percursoId, DuvidaPercurso duvida) {
        if (!duvida.getPercurso().getId().equals(percursoId)) {
            throw new IllegalArgumentException("Duvida nao encontrada para esse percurso.");
        }
    }

    private DuvidaPercurso buscarEntidade(UUID duvidaId) {
        return duvidaPercursoRepository.findById(duvidaId)
                .orElseThrow(() -> new IllegalArgumentException("Duvida nao encontrada."));
    }

    private void validarTimestamp(Integer timestampSegundos, Percurso percurso) {
        if (timestampSegundos == null || timestampSegundos < 0) {
            throw new IllegalArgumentException("Informe um trecho valido do video.");
        }
        Integer duracaoSegundos = percurso.getDuracaoSegundos();
        if (duracaoSegundos != null && duracaoSegundos > 0 && timestampSegundos > duracaoSegundos + 5) {
            throw new IllegalArgumentException("O trecho informado ultrapassa a duracao do percurso.");
        }
    }

    private Integer normalizarJanelaRelacionada(Integer valor) {
        if (valor == null) {
            return JANELA_RELACIONADA_SEGUNDOS_PADRAO;
        }
        return Math.max(0, Math.min(20, valor));
    }

    private String normalizarTitulo(String valor) {
        if (valor == null) {
            throw new IllegalArgumentException("Informe o titulo da duvida.");
        }
        String titulo = valor.trim();
        if (titulo.isBlank()) {
            throw new IllegalArgumentException("Informe o titulo da duvida.");
        }
        return titulo;
    }

    private String normalizarTexto(String valor) {
        if (valor == null) {
            return null;
        }
        String texto = valor.trim();
        return texto.isBlank() ? null : texto;
    }
}
