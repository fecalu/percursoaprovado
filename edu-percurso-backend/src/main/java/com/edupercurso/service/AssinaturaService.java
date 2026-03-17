package com.edupercurso.service;

import com.edupercurso.dto.AssinaturaDTO;
import com.edupercurso.entity.Assinatura;
import com.edupercurso.entity.Plano;
import com.edupercurso.entity.Usuario;
import com.edupercurso.repository.AssinaturaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AssinaturaService {

    private final AssinaturaRepository assinaturaRepository;
    private final UsuarioLookupService usuarioLookupService;
    private final PlanoService planoService;

    public List<AssinaturaDTO.Response> listarMinhas(String email) {
        Usuario usuario = usuarioLookupService.buscarPorEmail(email);
        atualizarAssinaturasExpiradas(usuario.getId());
        return assinaturaRepository.findByUsuarioIdOrderByFimEmDesc(usuario.getId())
                .stream()
                .map(AssinaturaDTO.Response::from)
                .toList();
    }

    public List<AssinaturaDTO.Response> listarTodas() {
        return assinaturaRepository.findAllByOrderByCriadoEmDesc()
                .stream()
                .map(AssinaturaDTO.Response::from)
                .toList();
    }

    public boolean possuiAssinaturaAtiva(UUID usuarioId, UUID localProvaId) {
        return assinaturaRepository.existsAssinaturaAtiva(usuarioId, localProvaId, LocalDateTime.now());
    }

    public boolean possuiQualquerAssinaturaAtiva(UUID usuarioId) {
        return assinaturaRepository.existsQualquerAssinaturaAtiva(usuarioId, LocalDateTime.now());
    }

    public Set<UUID> listarLocaisAtivos(UUID usuarioId) {
        return assinaturaRepository.findAtivasByUsuarioId(usuarioId, LocalDateTime.now())
                .stream()
                .map(assinatura -> assinatura.getLocalProva().getId())
                .collect(java.util.stream.Collectors.toSet());
    }

    @Transactional
    public AssinaturaDTO.Response criarManual(AssinaturaDTO.CreateRequest request) {
        Usuario usuario = usuarioLookupService.buscarPorEmail(request.getUsuarioEmail());
        Plano plano = planoService.buscarEntidadePorId(request.getPlanoId());
        LocalDateTime inicio = request.getInicioEm() == null ? LocalDateTime.now() : request.getInicioEm();
        return AssinaturaDTO.Response.from(criarAssinaturaPaga(usuario, plano, inicio));
    }

    @Transactional
    public Assinatura criarAssinaturaPaga(Usuario usuario, Plano plano, LocalDateTime inicio) {
        if (possuiAssinaturaAtiva(usuario.getId(), plano.getLocalProva().getId())) {
            throw new IllegalArgumentException("O aluno ja possui uma assinatura ativa para esse local de prova.");
        }

        LocalDateTime fim = inicio.plusDays(plano.getDuracaoDias());
        Assinatura assinatura = Assinatura.builder()
                .usuario(usuario)
                .plano(plano)
                .localProva(plano.getLocalProva())
                .inicioEm(inicio)
                .fimEm(fim)
                .status(Assinatura.Status.ATIVA)
                .paymentStatus(Assinatura.PaymentStatus.PAGO)
                .build();

        return assinaturaRepository.save(assinatura);
    }

    @Transactional
    public void cancelar(UUID id) {
        Assinatura assinatura = assinaturaRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Assinatura nao encontrada."));
        assinatura.setStatus(Assinatura.Status.CANCELADA);
        assinaturaRepository.save(assinatura);
    }

    @Transactional
    public void atualizarAssinaturasExpiradas(UUID usuarioId) {
        LocalDateTime agora = LocalDateTime.now();
        List<Assinatura> assinaturas = assinaturaRepository.findByUsuarioIdOrderByFimEmDesc(usuarioId);
        boolean alterou = false;
        for (Assinatura assinatura : assinaturas) {
            if (assinatura.getStatus() == Assinatura.Status.ATIVA && assinatura.getFimEm().isBefore(agora)) {
                assinatura.setStatus(Assinatura.Status.EXPIRADA);
                alterou = true;
            }
        }
        if (alterou) {
            assinaturaRepository.saveAll(assinaturas);
        }
    }
}
