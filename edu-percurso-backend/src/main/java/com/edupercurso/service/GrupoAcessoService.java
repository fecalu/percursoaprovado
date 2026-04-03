package com.edupercurso.service;

import com.edupercurso.dto.GrupoAcessoDTO;
import com.edupercurso.entity.GrupoAcesso;
import com.edupercurso.repository.GrupoAcessoRepository;
import com.edupercurso.repository.PercursoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GrupoAcessoService {

    private final GrupoAcessoRepository grupoAcessoRepository;
    private final PercursoRepository percursoRepository;

    @Transactional(readOnly = true)
    public List<GrupoAcesso> listar() {
        return grupoAcessoRepository.findAllByOrderByOrdemExibicaoAscNomeAsc();
    }

    @Transactional
    public GrupoAcesso criar(GrupoAcessoDTO.Request request) {
        String codigo = normalizarCodigo(request.getCodigo());
        String nome = normalizarNome(request.getNome());

        validarDuplicidade(null, codigo, nome);

        GrupoAcesso grupoAcesso = GrupoAcesso.builder()
                .codigo(codigo)
                .nome(nome)
                .descricao(normalizarTextoLivre(request.getDescricao()))
                .ordemExibicao(resolverOrdemExibicao(request.getOrdemExibicao()))
                .ativo(request.isAtivo())
                .build();

        return grupoAcessoRepository.save(grupoAcesso);
    }

    @Transactional
    public GrupoAcesso atualizar(UUID id, GrupoAcessoDTO.Request request) {
        GrupoAcesso grupoAcesso = buscarEntidade(id);
        String codigo = normalizarCodigo(request.getCodigo());
        String nome = normalizarNome(request.getNome());

        validarDuplicidade(id, codigo, nome);

        grupoAcesso.setCodigo(codigo);
        grupoAcesso.setNome(nome);
        grupoAcesso.setDescricao(normalizarTextoLivre(request.getDescricao()));
        grupoAcesso.setOrdemExibicao(request.getOrdemExibicao() == null ? grupoAcesso.getOrdemExibicao() : Math.max(0, request.getOrdemExibicao()));
        grupoAcesso.setAtivo(request.isAtivo());

        return grupoAcessoRepository.save(grupoAcesso);
    }

    @Transactional
    public void excluir(UUID id) {
        GrupoAcesso grupoAcesso = buscarEntidade(id);
        long totalAulasVinculadas = percursoRepository.countByGruposAcessoId(id);

        if (totalAulasVinculadas > 0) {
            String plural = totalAulasVinculadas == 1 ? "" : "s";
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Nao e possivel excluir este grupo de acesso porque ele ainda esta vinculado a "
                            + totalAulasVinculadas
                            + " aula"
                            + plural
                            + ". Remova esse grupo das aulas antes de excluir."
            );
        }

        grupoAcessoRepository.delete(grupoAcesso);
    }

    @Transactional(readOnly = true)
    public List<GrupoAcesso> buscarPorIds(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }

        List<GrupoAcesso> grupos = grupoAcessoRepository.findAllById(ids)
                .stream()
                .sorted((a, b) -> {
                    int ordemA = a.getOrdemExibicao() == null ? Integer.MAX_VALUE : a.getOrdemExibicao();
                    int ordemB = b.getOrdemExibicao() == null ? Integer.MAX_VALUE : b.getOrdemExibicao();
                    if (ordemA != ordemB) {
                        return Integer.compare(ordemA, ordemB);
                    }
                    return a.getNome().compareToIgnoreCase(b.getNome());
                })
                .toList();

        if (grupos.size() != ids.size()) {
            throw new IllegalArgumentException("Um ou mais grupos de acesso nao foram encontrados.");
        }

        return grupos;
    }

    @Transactional(readOnly = true)
    public GrupoAcesso buscarEntidade(UUID id) {
        return grupoAcessoRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Grupo de acesso nao encontrado."));
    }

    private Integer resolverOrdemExibicao(Integer ordemExibicao) {
        if (ordemExibicao != null) {
            return Math.max(0, ordemExibicao);
        }

        return grupoAcessoRepository.findTopByOrderByOrdemExibicaoDesc()
                .map(GrupoAcesso::getOrdemExibicao)
                .orElse(0) + 1;
    }

    private void validarDuplicidade(UUID id, String codigo, String nome) {
        boolean codigoJaExiste = id == null
                ? grupoAcessoRepository.existsByCodigoIgnoreCase(codigo)
                : grupoAcessoRepository.existsByCodigoIgnoreCaseAndIdNot(codigo, id);

        if (codigoJaExiste) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ja existe um grupo de acesso com esse codigo.");
        }

        boolean nomeJaExiste = id == null
                ? grupoAcessoRepository.existsByNomeIgnoreCase(nome)
                : grupoAcessoRepository.existsByNomeIgnoreCaseAndIdNot(nome, id);

        if (nomeJaExiste) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ja existe um grupo de acesso com esse nome.");
        }
    }

    private String normalizarCodigo(String valor) {
        if (!StringUtils.hasText(valor)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o codigo do grupo de acesso.");
        }

        String semAcento = Normalizer.normalize(valor.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");

        String codigo = semAcento
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "_")
                .replaceAll("^_+|_+$", "");

        if (!StringUtils.hasText(codigo)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe um codigo valido para o grupo de acesso.");
        }

        return codigo;
    }

    private String normalizarNome(String valor) {
        if (!StringUtils.hasText(valor)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o nome do grupo de acesso.");
        }
        return valor.trim();
    }

    private String normalizarTextoLivre(String valor) {
        return StringUtils.hasText(valor) ? valor.trim() : null;
    }
}
