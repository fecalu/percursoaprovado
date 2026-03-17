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
                .nome(request.getNome().trim())
                .duracaoDias(request.getDuracaoDias())
                .precoCentavos(request.getPrecoCentavos())
                .ativo(request.isAtivo())
                .build();

        return PlanoDTO.Response.from(planoRepository.save(plano));
    }

    @Transactional
    public PlanoDTO.Response atualizar(UUID id, PlanoDTO.Request request) {
        Plano plano = buscarEntidadePorId(id);
        plano.setLocalProva(localProvaService.buscarEntidadePorId(request.getLocalProvaId()));
        plano.setNome(request.getNome().trim());
        plano.setDuracaoDias(request.getDuracaoDias());
        plano.setPrecoCentavos(request.getPrecoCentavos());
        plano.setAtivo(request.isAtivo());

        return PlanoDTO.Response.from(planoRepository.save(plano));
    }

    @Transactional
    public void excluir(UUID id) {
        if (!planoRepository.existsById(id)) {
            throw new IllegalArgumentException("Plano nao encontrado.");
        }
        planoRepository.deleteById(id);
    }

    public Plano buscarEntidadePorId(UUID id) {
        return planoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Plano nao encontrado."));
    }
}
