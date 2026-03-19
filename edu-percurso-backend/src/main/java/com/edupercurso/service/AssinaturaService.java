package com.edupercurso.service;

import com.edupercurso.dto.AssinaturaDTO;
import com.edupercurso.entity.Assinatura;
import com.edupercurso.entity.Plano;
import com.edupercurso.entity.Pedido;
import com.edupercurso.entity.Usuario;
import com.edupercurso.repository.AssinaturaRepository;
import com.edupercurso.repository.PedidoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AssinaturaService {

    private final AssinaturaRepository assinaturaRepository;
    private final PedidoRepository pedidoRepository;
    private final UsuarioLookupService usuarioLookupService;
    private final PlanoService planoService;

    public List<AssinaturaDTO.Response> listarMinhas(String email) {
        Usuario usuario = usuarioLookupService.buscarPorEmail(email);
        List<Assinatura> assinaturas = assinaturaRepository.findByUsuarioIdOrderByFimEmDesc(usuario.getId());
        atualizarAssinaturasExpiradas(assinaturas);
        return montarRespostas(assinaturas);
    }

    public List<AssinaturaDTO.Response> listarTodas() {
        List<Assinatura> assinaturas = assinaturaRepository.findAllByOrderByCriadoEmDesc();
        atualizarAssinaturasExpiradas(assinaturas);
        return montarRespostas(assinaturas);
    }

    public AssinaturaDTO.Response detalhar(UUID id) {
        Assinatura assinatura = buscarEntidade(id);
        atualizarAssinaturasExpiradas(List.of(assinatura));
        return montarResposta(assinatura, pedidoRepository.findByAssinaturaIdIn(List.of(assinatura.getId()))
                .stream()
                .findFirst()
                .orElse(null));
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
        Assinatura.Origem origem = normalizarOrigemManual(request.getOrigem());
        return montarResposta(criarAssinaturaPaga(usuario, plano, inicio, origem, request.getObservacaoInterna()), null);
    }

    @Transactional
    public Assinatura criarAssinaturaPaga(Usuario usuario, Plano plano, LocalDateTime inicio) {
        return criarAssinaturaPaga(usuario, plano, inicio, Assinatura.Origem.CHECKOUT, null);
    }

    @Transactional
    public Assinatura criarAssinaturaPaga(
            Usuario usuario,
            Plano plano,
            LocalDateTime inicio,
            Assinatura.Origem origem,
            String observacaoInterna) {
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
                .origem(origem)
                .observacaoInterna(normalizarTexto(observacaoInterna))
                .build();

        return assinaturaRepository.save(assinatura);
    }

    @Transactional
    public AssinaturaDTO.Response atualizar(UUID id, AssinaturaDTO.UpdateRequest request) {
        Assinatura assinatura = buscarEntidade(id);
        if (request.getFimEm() != null) {
            validarAjusteValidade(assinatura, request.getFimEm());
            assinatura.setFimEm(request.getFimEm());
            atualizarStatusPorValidade(assinatura, LocalDateTime.now());
        }

        if (StringUtils.hasText(request.getOrigem())) {
            assinatura.setOrigem(normalizarOrigem(request.getOrigem()));
        }

        assinatura.setObservacaoInterna(normalizarTexto(request.getObservacaoInterna()));
        return montarResposta(assinaturaRepository.save(assinatura), buscarPedidoDaAssinatura(assinatura.getId()));
    }

    @Transactional
    public AssinaturaDTO.Response prorrogar(UUID id, AssinaturaDTO.ExtendRequest request) {
        Assinatura assinatura = buscarEntidade(id);
        if (assinatura.getStatus() == Assinatura.Status.CANCELADA) {
            throw new IllegalArgumentException("Nao e possivel prorrogar uma assinatura cancelada.");
        }

        LocalDateTime agora = LocalDateTime.now();
        LocalDateTime base = assinatura.getFimEm().isAfter(agora) ? assinatura.getFimEm() : agora;
        assinatura.setFimEm(base.plusDays(request.getDias()));
        atualizarStatusPorValidade(assinatura, agora);
        if (StringUtils.hasText(request.getObservacaoInterna())) {
            assinatura.setObservacaoInterna(normalizarTexto(request.getObservacaoInterna()));
        }

        return montarResposta(assinaturaRepository.save(assinatura), buscarPedidoDaAssinatura(assinatura.getId()));
    }

    @Transactional
    public AssinaturaDTO.Response cancelar(UUID id, String actorEmail, AssinaturaDTO.CancelRequest request) {
        Assinatura assinatura = buscarEntidade(id);
        cancelarEntidade(
                assinatura,
                actorEmail,
                request == null ? null : request.getMotivoCancelamento(),
                null
        );
        return montarResposta(assinaturaRepository.save(assinatura), buscarPedidoDaAssinatura(assinatura.getId()));
    }

    @Transactional
    public Assinatura cancelarPorSolicitacao(
            Assinatura assinatura,
            String actorEmail,
            String motivoCancelamento,
            String observacaoInterna) {
        cancelarEntidade(assinatura, actorEmail, motivoCancelamento, observacaoInterna);
        return assinaturaRepository.save(assinatura);
    }

    @Transactional
    public void atualizarAssinaturasExpiradas(UUID usuarioId) {
        atualizarAssinaturasExpiradas(assinaturaRepository.findByUsuarioIdOrderByFimEmDesc(usuarioId));
    }

    public Assinatura buscarEntidade(UUID id) {
        return assinaturaRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Assinatura nao encontrada."));
    }

    private List<AssinaturaDTO.Response> montarRespostas(List<Assinatura> assinaturas) {
        if (assinaturas.isEmpty()) {
            return List.of();
        }

        Map<UUID, Pedido> pedidosPorAssinatura = pedidoRepository.findByAssinaturaIdIn(
                        assinaturas.stream().map(Assinatura::getId).toList()
                )
                .stream()
                .filter(pedido -> pedido.getAssinatura() != null)
                .collect(Collectors.toMap(
                        pedido -> pedido.getAssinatura().getId(),
                        Function.identity()
                ));

        return assinaturas.stream()
                .map(assinatura -> montarResposta(assinatura, pedidosPorAssinatura.get(assinatura.getId())))
                .toList();
    }

    private AssinaturaDTO.Response montarResposta(Assinatura assinatura, Pedido pedido) {
        return AssinaturaDTO.Response.from(assinatura, pedido, calcularDiasRestantes(assinatura, LocalDateTime.now()));
    }

    private Pedido buscarPedidoDaAssinatura(UUID assinaturaId) {
        return pedidoRepository.findByAssinaturaIdIn(List.of(assinaturaId))
                .stream()
                .findFirst()
                .orElse(null);
    }

    private void atualizarAssinaturasExpiradas(List<Assinatura> assinaturas) {
        LocalDateTime agora = LocalDateTime.now();
        boolean alterou = false;
        for (Assinatura assinatura : assinaturas) {
            if (atualizarStatusPorValidade(assinatura, agora)) {
                alterou = true;
            }
        }
        if (alterou) {
            assinaturaRepository.saveAll(assinaturas);
        }
    }

    private boolean atualizarStatusPorValidade(Assinatura assinatura, LocalDateTime agora) {
        if (assinatura.getStatus() == Assinatura.Status.CANCELADA) {
            return false;
        }

        Assinatura.Status statusAnterior = assinatura.getStatus();
        if (assinatura.getFimEm().isBefore(agora)) {
            assinatura.setStatus(Assinatura.Status.EXPIRADA);
        } else {
            assinatura.setStatus(Assinatura.Status.ATIVA);
        }
        return statusAnterior != assinatura.getStatus();
    }

    private void validarAjusteValidade(Assinatura assinatura, LocalDateTime novoFim) {
        if (assinatura.getStatus() == Assinatura.Status.CANCELADA) {
            throw new IllegalArgumentException("Nao e possivel ajustar a validade de uma assinatura cancelada.");
        }
        if (novoFim.isBefore(assinatura.getInicioEm())) {
            throw new IllegalArgumentException("A data final nao pode ser anterior ao inicio da assinatura.");
        }
    }

    private int calcularDiasRestantes(Assinatura assinatura, LocalDateTime agora) {
        if (assinatura.getStatus() != Assinatura.Status.ATIVA) {
            return 0;
        }
        long dias = ChronoUnit.DAYS.between(agora.toLocalDate(), assinatura.getFimEm().toLocalDate());
        return (int) Math.max(dias, 0);
    }

    private Assinatura.Origem normalizarOrigemManual(String origem) {
        if (!StringUtils.hasText(origem)) {
            return Assinatura.Origem.MANUAL;
        }
        Assinatura.Origem origemNormalizada = normalizarOrigem(origem);
        if (origemNormalizada == Assinatura.Origem.CHECKOUT) {
            throw new IllegalArgumentException("Use MANUAL ou CORTESIA para criar assinaturas pelo admin.");
        }
        return origemNormalizada;
    }

    private Assinatura.Origem normalizarOrigem(String origem) {
        try {
            return Assinatura.Origem.valueOf(origem.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Origem da assinatura invalida.");
        }
    }

    private String normalizarTexto(String valor) {
        return StringUtils.hasText(valor) ? valor.trim() : null;
    }

    private void cancelarEntidade(
            Assinatura assinatura,
            String actorEmail,
            String motivoCancelamento,
            String observacaoInterna) {
        if (assinatura.getStatus() == Assinatura.Status.CANCELADA) {
            throw new IllegalArgumentException("Essa assinatura ja esta cancelada.");
        }
        assinatura.setStatus(Assinatura.Status.CANCELADA);
        assinatura.setCanceladaEm(LocalDateTime.now());
        assinatura.setCanceladaPorEmail(actorEmail);
        assinatura.setMotivoCancelamento(normalizarTexto(motivoCancelamento));
        if (StringUtils.hasText(observacaoInterna)) {
            assinatura.setObservacaoInterna(concatenarObservacao(assinatura.getObservacaoInterna(), observacaoInterna));
        }
    }

    private String concatenarObservacao(String atual, String novaObservacao) {
        String nova = normalizarTexto(novaObservacao);
        if (!StringUtils.hasText(atual)) {
            return nova;
        }
        if (!StringUtils.hasText(nova)) {
            return atual;
        }
        return atual + System.lineSeparator() + nova;
    }
}
