package com.edupercurso.service;

import com.edupercurso.dto.PlanoDTO;
import com.edupercurso.entity.Plano;
import com.edupercurso.repository.PlanoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PlanoService {

    private final PlanoRepository planoRepository;
    private final LocalProvaService localProvaService;
    private final TrilhaService trilhaService;

    private String normalizarTextoLivre(String valor) {
        if (valor == null) {
            return null;
        }

        String texto = valor.trim();
        return texto.isBlank() ? null : texto;
    }

    private void aplicarCheckoutPersonalizado(Plano plano, PlanoDTO.Request request) {
        plano.setUsarCheckoutPersonalizado(request.isUsarCheckoutPersonalizado());
        plano.setCheckoutKicker(normalizarTextoLivre(request.getCheckoutKicker()));
        plano.setCheckoutTitulo(normalizarTextoLivre(request.getCheckoutTitulo()));
        plano.setCheckoutSubtitulo(normalizarTextoLivre(request.getCheckoutSubtitulo()));
        plano.setCheckoutBeneficiosTitulo(normalizarTextoLivre(request.getCheckoutBeneficiosTitulo()));
        plano.setCheckoutBeneficiosTexto(normalizarTextoLivre(request.getCheckoutBeneficiosTexto()));
        plano.setCheckoutAjudaTitulo(normalizarTextoLivre(request.getCheckoutAjudaTitulo()));
        plano.setCheckoutAjudaTexto(normalizarTextoLivre(request.getCheckoutAjudaTexto()));
        plano.setCheckoutConfiancaTexto(normalizarTextoLivre(request.getCheckoutConfiancaTexto()));
        plano.setCheckoutResumoKicker(normalizarTextoLivre(request.getCheckoutResumoKicker()));
        plano.setCheckoutResumoTexto(normalizarTextoLivre(request.getCheckoutResumoTexto()));
        plano.setCheckoutPrecoLabel(normalizarTextoLivre(request.getCheckoutPrecoLabel()));
        plano.setCheckoutPrecoTexto(normalizarTextoLivre(request.getCheckoutPrecoTexto()));
        plano.setCheckoutSeguroTexto(normalizarTextoLivre(request.getCheckoutSeguroTexto()));
    }

    private void aplicarVitrinePersonalizada(Plano plano, PlanoDTO.Request request) {
        plano.setVitrineSelo(normalizarTextoLivre(request.getVitrineSelo()));
        plano.setVitrineResumo(normalizarTextoLivre(request.getVitrineResumo()));
        plano.setVitrineTexto(normalizarTextoLivre(request.getVitrineTexto()));
        plano.setVitrineMeta(normalizarTextoLivre(request.getVitrineMeta()));
        plano.setVitrineRecomendada(request.getVitrineRecomendada());
    }

    private void aplicarTrilhaPrincipal(Plano plano, PlanoDTO.Request request) {
        if (request.getTrilhaId() == null) {
            throw new IllegalArgumentException("Selecione o perfil da jornada deste plano.");
        }

        plano.setTrilhaPrincipal(trilhaService.buscarEntidade(request.getTrilhaId()));
    }

    @Transactional(readOnly = true)
    public List<PlanoDTO.Response> listar(String localSlug, boolean todos) {
        List<Plano> planos;
        if (localSlug != null && !localSlug.isBlank()) {
            var localProva = localProvaService.buscarEntidadePorSlug(localSlug);
            if (todos) {
                planos = planoRepository.findByLocalProvaIdOrderByDuracaoDiasAsc(
                        localProva.getId()
                );
            } else {
                if (!localProvaService.permiteCompra(localProva)) {
                    return List.of();
                }
                planos = planoRepository.findByLocalProvaSlugAndAtivoTrueOrderByDuracaoDiasAsc(localSlug);
            }
        } else {
            planos = todos
                    ? planoRepository.findAll().stream().sorted((a, b) -> a.getDuracaoDias().compareTo(b.getDuracaoDias())).toList()
                    : planoRepository.findByAtivoTrueOrderByDuracaoDiasAsc().stream()
                    .filter(plano -> localProvaService.permiteCompra(plano.getLocalProva()))
                    .toList();
        }

        return planos.stream()
                .map(PlanoDTO.Response::from)
                .toList();
    }

    @Transactional
    public PlanoDTO.Response criar(PlanoDTO.Request request) {
        Plano plano = Plano.builder()
                .localProva(localProvaService.buscarEntidadePorId(request.getLocalProvaId()))
                .trilhaPrincipal(trilhaService.buscarEntidade(request.getTrilhaId()))
                .nome(request.getNome().trim())
                .duracaoDias(request.getDuracaoDias())
                .precoCentavos(request.getPrecoCentavos())
                .ativo(request.isAtivo())
                .build();

        aplicarCheckoutPersonalizado(plano, request);
        aplicarVitrinePersonalizada(plano, request);

        return PlanoDTO.Response.from(planoRepository.save(plano));
    }

    @Transactional
    public PlanoDTO.Response atualizar(UUID id, PlanoDTO.Request request) {
        Plano plano = buscarEntidadePorId(id);
        plano.setLocalProva(localProvaService.buscarEntidadePorId(request.getLocalProvaId()));
        aplicarTrilhaPrincipal(plano, request);
        plano.setNome(request.getNome().trim());
        plano.setDuracaoDias(request.getDuracaoDias());
        plano.setPrecoCentavos(request.getPrecoCentavos());
        plano.setAtivo(request.isAtivo());
        aplicarCheckoutPersonalizado(plano, request);
        aplicarVitrinePersonalizada(plano, request);

        return PlanoDTO.Response.from(planoRepository.save(plano));
    }

    @Transactional
    public void excluir(UUID id) {
        if (!planoRepository.existsById(id)) {
            throw new IllegalArgumentException("Plano nao encontrado.");
        }
        planoRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public Plano buscarEntidadePorId(UUID id) {
        return planoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Plano nao encontrado."));
    }
}
