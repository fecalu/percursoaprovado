package com.edupercurso.service;

import com.edupercurso.dto.TrilhaDTO;
import com.edupercurso.entity.Assinatura;
import com.edupercurso.entity.GrupoAcesso;
import com.edupercurso.entity.Trilha;
import com.edupercurso.entity.TrilhaEtapa;
import com.edupercurso.repository.AssinaturaRepository;
import com.edupercurso.repository.PlanoRepository;
import com.edupercurso.repository.TrilhaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class TrilhaService {

    private final TrilhaRepository trilhaRepository;
    private final GrupoAcessoService grupoAcessoService;
    private final PlanoRepository planoRepository;
    private final AssinaturaRepository assinaturaRepository;
    private final UsuarioLookupService usuarioLookupService;

    @Transactional(readOnly = true)
    public List<Trilha> listarAtivasDoAluno(String email) {
        var usuario = usuarioLookupService.buscarPorEmail(email);
        List<Assinatura> assinaturasAtivas = assinaturaRepository.findAtivasByUsuarioId(usuario.getId(), LocalDateTime.now());

        if (assinaturasAtivas.isEmpty()) {
            return List.of();
        }

        Set<UUID> trilhasLiberadas = assinaturasAtivas.stream()
                .map(Assinatura::getPlano)
                .filter(Objects::nonNull)
                .map(plano -> plano.getTrilhaPrincipal())
                .filter(Objects::nonNull)
                .map(Trilha::getId)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));

        if (trilhasLiberadas.isEmpty()) {
            return List.of();
        }

        return trilhaRepository.findAllByAtivoTrueOrderByOrdemExibicaoAscNomeAsc().stream()
                .filter(trilha -> trilhasLiberadas.contains(trilha.getId()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<Trilha> listarAdmin() {
        return trilhaRepository.findAllByOrderByOrdemExibicaoAscNomeAsc();
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
        trilha.setOrdemExibicao(request.getOrdemExibicao() == null ? trilha.getOrdemExibicao() : Math.max(0, request.getOrdemExibicao()));
        trilha.setAtivo(request.isAtivo());
        trilha.substituirEtapas(montarEtapas(request.getEtapas()));

        return trilhaRepository.save(trilha);
    }

    @Transactional
    public void excluir(UUID id) {
        Trilha trilha = buscarEntidade(id);
        long totalPlanos = planoRepository.countByTrilhaPrincipalId(id);

        if (totalPlanos > 0) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    totalPlanos == 1
                            ? "Nao e possivel excluir a trilha porque ela esta vinculada a 1 plano."
                            : "Nao e possivel excluir a trilha porque ela esta vinculada a " + totalPlanos + " planos."
            );
        }

        trilhaRepository.delete(trilha);
    }

    @Transactional(readOnly = true)
    public Trilha buscarEntidade(UUID id) {
        return trilhaRepository.findAllByOrderByOrdemExibicaoAscNomeAsc().stream()
                .filter(trilha -> trilha.getId().equals(id))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trilha nao encontrada."));
    }

    private Integer resolverOrdemExibicao(Integer ordemExibicao) {
        if (ordemExibicao != null) {
            return Math.max(0, ordemExibicao);
        }

        return trilhaRepository.findTopByOrderByOrdemExibicaoDesc()
                .map(Trilha::getOrdemExibicao)
                .orElse(0) + 1;
    }

    private List<TrilhaEtapa> montarEtapas(List<TrilhaDTO.EtapaRequest> etapasRequest) {
        if (etapasRequest == null || etapasRequest.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Adicione pelo menos uma etapa na trilha.");
        }

        List<UUID> gruposIds = etapasRequest.stream()
                .map(TrilhaDTO.EtapaRequest::getGrupoAcessoId)
                .toList();

        List<GrupoAcesso> grupos = grupoAcessoService.buscarPorIds(gruposIds);
        Map<UUID, GrupoAcesso> gruposPorId = new HashMap<>();
        grupos.forEach(grupo -> gruposPorId.put(grupo.getId(), grupo));

        Set<UUID> gruposJaUsados = new HashSet<>();
        List<TrilhaEtapa> etapas = new ArrayList<>();

        for (int index = 0; index < etapasRequest.size(); index++) {
            TrilhaDTO.EtapaRequest etapaRequest = etapasRequest.get(index);
            UUID grupoId = etapaRequest.getGrupoAcessoId();

            if (!gruposJaUsados.add(grupoId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nao repita o mesmo grupo de acesso dentro da mesma trilha.");
            }

            GrupoAcesso grupoAcesso = gruposPorId.get(grupoId);
            if (grupoAcesso == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Um ou mais grupos de acesso nao foram encontrados.");
            }

            String titulo = normalizarNome(etapaRequest.getTitulo());
            String resumo = normalizarTextoLivre(etapaRequest.getResumo());
            int ordem = etapaRequest.getOrdemExibicao() == null ? index + 1 : Math.max(0, etapaRequest.getOrdemExibicao());

            etapas.add(TrilhaEtapa.builder()
                    .grupoAcesso(grupoAcesso)
                    .titulo(titulo)
                    .resumo(resumo)
                    .ordemExibicao(ordem)
                    .ativo(etapaRequest.isAtivo())
                    .build());
        }

        etapas.sort(Comparator
                .comparing((TrilhaEtapa item) -> item.getOrdemExibicao() == null ? Integer.MAX_VALUE : item.getOrdemExibicao())
                .thenComparing(TrilhaEtapa::getTitulo, String.CASE_INSENSITIVE_ORDER));

        return etapas;
    }

    private void validarDuplicidade(UUID id, String codigo, String nome) {
        boolean codigoJaExiste = id == null
                ? trilhaRepository.existsByCodigoIgnoreCase(codigo)
                : trilhaRepository.existsByCodigoIgnoreCaseAndIdNot(codigo, id);

        if (codigoJaExiste) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ja existe uma trilha com esse codigo.");
        }

        boolean nomeJaExiste = id == null
                ? trilhaRepository.existsByNomeIgnoreCase(nome)
                : trilhaRepository.existsByNomeIgnoreCaseAndIdNot(nome, id);

        if (nomeJaExiste) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ja existe uma trilha com esse nome.");
        }
    }

    private String normalizarCodigo(String valor) {
        if (!StringUtils.hasText(valor)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o codigo da trilha.");
        }

        String semAcento = Normalizer.normalize(valor.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");

        String codigo = semAcento
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "_")
                .replaceAll("^_+|_+$", "");

        if (!StringUtils.hasText(codigo)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe um codigo valido para a trilha.");
        }

        return codigo;
    }

    private String normalizarNome(String valor) {
        if (!StringUtils.hasText(valor)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o nome da trilha.");
        }

        return valor.trim();
    }

    private String normalizarTextoLivre(String valor) {
        return StringUtils.hasText(valor) ? valor.trim() : null;
    }
}
