package com.edupercurso.service;

import com.edupercurso.dto.TrilhaDTO;
import com.edupercurso.entity.GrupoAcesso;
import com.edupercurso.entity.Trilha;
import com.edupercurso.entity.TrilhaEtapa;
import com.edupercurso.repository.PlanoRepository;
import com.edupercurso.repository.TrilhaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.text.Normalizer;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TrilhaService {

    private final TrilhaRepository trilhaRepository;
    private final PlanoRepository planoRepository;
    private final GrupoAcessoService grupoAcessoService;

    @Transactional(readOnly = true)
    public List<Trilha> listar(boolean somenteAtivas) {
        return somenteAtivas
                ? trilhaRepository.findAllByAtivoTrueOrderByOrdemExibicaoAscNomeAsc()
                : trilhaRepository.findAllByOrderByOrdemExibicaoAscNomeAsc();
    }

    @Transactional
    public Trilha criar(TrilhaDTO.Request request) {
        String codigo = normalizarCodigo(request.getCodigo());
        String nome = normalizarNome(request.getNome());

        validarDuplicidade(null, codigo, nome);

        Trilha trilha = Trilha.builder()
                .codigo(codigo)
                .nome(nome)
                .descricao(normalizarTextoLivre(request.getDescricao()))
                .ordemExibicao(resolverOrdemExibicao(request.getOrdemExibicao()))
                .ativo(request.isAtivo())
                .build();

        trilha.substituirEtapas(montarEtapas(request.getEtapas()));
        return trilhaRepository.save(trilha);
    }

    @Transactional
    public Trilha atualizar(UUID id, TrilhaDTO.Request request) {
        Trilha trilha = buscarEntidade(id);
        String codigo = normalizarCodigo(request.getCodigo());
        String nome = normalizarNome(request.getNome());

        validarDuplicidade(id, codigo, nome);

        trilha.setCodigo(codigo);
        trilha.setNome(nome);
        trilha.setDescricao(normalizarTextoLivre(request.getDescricao()));
        trilha.setOrdemExibicao(request.getOrdemExibicao() == null
                ? trilha.getOrdemExibicao()
                : Math.max(0, request.getOrdemExibicao()));
        trilha.setAtivo(request.isAtivo());
        trilha.substituirEtapas(montarEtapas(request.getEtapas()));

        return trilhaRepository.save(trilha);
    }

    @Transactional
    public void excluir(UUID id) {
        Trilha trilha = buscarEntidade(id);
        long planosVinculados = planoRepository.countByTrilhaPrincipalId(id);

        if (planosVinculados > 0) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Nao e possivel excluir este perfil da jornada porque ele ainda esta vinculado a "
                            + planosVinculados
                            + " plano"
                            + (planosVinculados == 1 ? "." : "s.")
            );
        }

        trilhaRepository.delete(trilha);
    }

    @Transactional(readOnly = true)
    public Trilha buscarEntidade(UUID id) {
        return trilhaRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Perfil da jornada nao encontrado."));
    }

    private List<TrilhaEtapa> montarEtapas(List<TrilhaDTO.EtapaRequest> etapas) {
        if (etapas == null || etapas.isEmpty()) {
            return List.of();
        }

        return etapas.stream()
                .map(this::montarEtapa)
                .sorted(Comparator
                        .comparing(TrilhaEtapa::getOrdemExibicao, Comparator.nullsLast(Integer::compareTo))
                        .thenComparing(TrilhaEtapa::getTitulo, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private TrilhaEtapa montarEtapa(TrilhaDTO.EtapaRequest request) {
        GrupoAcesso grupoAcesso = grupoAcessoService.buscarEntidade(request.getGrupoAcessoId());

        return TrilhaEtapa.builder()
                .grupoAcesso(grupoAcesso)
                .titulo(normalizarNome(request.getTitulo()))
                .resumo(normalizarTextoLivre(request.getResumo()))
                .ordemExibicao(request.getOrdemExibicao() == null ? 0 : Math.max(0, request.getOrdemExibicao()))
                .ativo(request.isAtivo())
                .build();
    }

    private Integer resolverOrdemExibicao(Integer ordemExibicao) {
        if (ordemExibicao != null) {
            return Math.max(0, ordemExibicao);
        }

        return trilhaRepository.findTopByOrderByOrdemExibicaoDesc()
                .map(Trilha::getOrdemExibicao)
                .orElse(0) + 1;
    }

    private void validarDuplicidade(UUID id, String codigo, String nome) {
        boolean codigoJaExiste = id == null
                ? trilhaRepository.existsByCodigoIgnoreCase(codigo)
                : trilhaRepository.existsByCodigoIgnoreCaseAndIdNot(codigo, id);

        if (codigoJaExiste) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ja existe um perfil da jornada com esse codigo.");
        }

        boolean nomeJaExiste = id == null
                ? trilhaRepository.existsByNomeIgnoreCase(nome)
                : trilhaRepository.existsByNomeIgnoreCaseAndIdNot(nome, id);

        if (nomeJaExiste) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ja existe um perfil da jornada com esse nome.");
        }
    }

    private String normalizarCodigo(String valor) {
        if (!StringUtils.hasText(valor)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o codigo do perfil da jornada.");
        }

        String semAcento = Normalizer.normalize(valor.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");

        String codigo = semAcento
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "_")
                .replaceAll("^_+|_+$", "");

        if (!StringUtils.hasText(codigo)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe um codigo valido para o perfil da jornada.");
        }

        return codigo;
    }

    private String normalizarNome(String valor) {
        if (!StringUtils.hasText(valor)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o nome do perfil da jornada.");
        }
        return valor.trim();
    }

    private String normalizarTextoLivre(String valor) {
        return StringUtils.hasText(valor) ? valor.trim() : null;
    }
}
