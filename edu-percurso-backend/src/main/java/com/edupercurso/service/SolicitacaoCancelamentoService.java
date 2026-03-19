package com.edupercurso.service;

import com.edupercurso.dto.SolicitacaoCancelamentoDTO;
import com.edupercurso.entity.Assinatura;
import com.edupercurso.entity.Pedido;
import com.edupercurso.entity.SolicitacaoCancelamento;
import com.edupercurso.entity.Usuario;
import com.edupercurso.repository.PedidoRepository;
import com.edupercurso.repository.SolicitacaoCancelamentoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SolicitacaoCancelamentoService {

    private static final int PRAZO_DIAS = 7;

    private final SolicitacaoCancelamentoRepository solicitacaoRepository;
    private final PedidoRepository pedidoRepository;
    private final UsuarioLookupService usuarioLookupService;
    private final AssinaturaService assinaturaService;

    public Map<UUID, SolicitacaoCancelamento> mapearPorPedidoIds(Collection<UUID> pedidoIds) {
        if (pedidoIds == null || pedidoIds.isEmpty()) {
            return Map.of();
        }

        return solicitacaoRepository.findByPedidoIdIn(pedidoIds)
                .stream()
                .collect(Collectors.toMap(solicitacao -> solicitacao.getPedido().getId(), Function.identity()));
    }

    public LocalDateTime calcularPrazoCancelamento(Pedido pedido) {
        if (pedido.getStatus() != Pedido.Status.PAGO || pedido.getPagoEm() == null) {
            return null;
        }
        return pedido.getPagoEm().plusDays(PRAZO_DIAS);
    }

    public boolean podeSolicitarCancelamento(Pedido pedido, SolicitacaoCancelamento solicitacao) {
        return podeSolicitarCancelamento(pedido, solicitacao, LocalDateTime.now());
    }

    public boolean podeSolicitarCancelamento(Pedido pedido, SolicitacaoCancelamento solicitacao, LocalDateTime agora) {
        if (pedido.getStatus() != Pedido.Status.PAGO || pedido.getPagoEm() == null) {
            return false;
        }
        if (solicitacao != null) {
            return false;
        }

        LocalDateTime prazo = calcularPrazoCancelamento(pedido);
        return prazo != null && !agora.isAfter(prazo);
    }

    public List<SolicitacaoCancelamentoDTO.Response> listarTodas() {
        return solicitacaoRepository.findAllByOrderByCriadoEmDesc()
                .stream()
                .map(SolicitacaoCancelamentoDTO.Response::from)
                .toList();
    }

    @Transactional
    public SolicitacaoCancelamentoDTO.Response solicitar(String email, UUID pedidoId, SolicitacaoCancelamentoDTO.CreateRequest request) {
        Usuario usuario = usuarioLookupService.buscarPorEmail(email);
        Pedido pedido = pedidoRepository.findByIdAndUsuarioId(pedidoId, usuario.getId())
                .orElseThrow(() -> new IllegalArgumentException("Pedido nao encontrado."));

        SolicitacaoCancelamento existente = solicitacaoRepository.findByPedidoId(pedidoId).orElse(null);
        validarPedidoElegivel(pedido, existente, LocalDateTime.now());

        SolicitacaoCancelamento solicitacao = SolicitacaoCancelamento.builder()
                .pedido(pedido)
                .usuario(usuario)
                .motivo(request.getMotivo().trim())
                .observacaoAluno(normalizarTexto(request.getObservacaoAluno()))
                .status(SolicitacaoCancelamento.Status.ABERTA)
                .build();

        return SolicitacaoCancelamentoDTO.Response.from(solicitacaoRepository.save(solicitacao));
    }

    @Transactional
    public SolicitacaoCancelamentoDTO.Response aprovar(UUID id, String actorEmail, SolicitacaoCancelamentoDTO.ProcessRequest request) {
        SolicitacaoCancelamento solicitacao = buscarEntidade(id);
        validarProcessamento(solicitacao);

        solicitacao.setStatus(SolicitacaoCancelamento.Status.APROVADA);
        solicitacao.setObservacaoAdmin(normalizarTexto(request == null ? null : request.getObservacaoAdmin()));
        solicitacao.setProcessadoPorEmail(actorEmail);
        solicitacao.setProcessadoEm(LocalDateTime.now());

        Pedido pedido = solicitacao.getPedido();
        Assinatura assinatura = pedido.getAssinatura();
        if (assinatura != null && assinatura.getStatus() != Assinatura.Status.CANCELADA) {
            String motivo = "Solicitacao de cancelamento aprovada";
            String observacaoInterna = montarObservacaoInterna(solicitacao);
            assinaturaService.cancelarPorSolicitacao(assinatura, actorEmail, motivo, observacaoInterna);
        }

        return SolicitacaoCancelamentoDTO.Response.from(solicitacaoRepository.save(solicitacao));
    }

    @Transactional
    public SolicitacaoCancelamentoDTO.Response negar(UUID id, String actorEmail, SolicitacaoCancelamentoDTO.ProcessRequest request) {
        SolicitacaoCancelamento solicitacao = buscarEntidade(id);
        validarProcessamento(solicitacao);

        solicitacao.setStatus(SolicitacaoCancelamento.Status.NEGADA);
        solicitacao.setObservacaoAdmin(normalizarTexto(request == null ? null : request.getObservacaoAdmin()));
        solicitacao.setProcessadoPorEmail(actorEmail);
        solicitacao.setProcessadoEm(LocalDateTime.now());

        return SolicitacaoCancelamentoDTO.Response.from(solicitacaoRepository.save(solicitacao));
    }

    public SolicitacaoCancelamento buscarEntidade(UUID id) {
        return solicitacaoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Solicitacao de cancelamento nao encontrada."));
    }

    private void validarPedidoElegivel(Pedido pedido, SolicitacaoCancelamento existente, LocalDateTime agora) {
        if (pedido.getStatus() != Pedido.Status.PAGO || pedido.getPagoEm() == null) {
            throw new IllegalArgumentException("A solicitacao de cancelamento so fica disponivel para pagamentos confirmados.");
        }
        if (existente != null) {
            throw new IllegalArgumentException("Ja existe uma solicitacao de cancelamento para esse pedido.");
        }
        if (agora.isAfter(calcularPrazoCancelamento(pedido))) {
            throw new IllegalArgumentException("O prazo de 7 dias para solicitar cancelamento desse pagamento ja expirou.");
        }
    }

    private void validarProcessamento(SolicitacaoCancelamento solicitacao) {
        if (solicitacao.getStatus() != SolicitacaoCancelamento.Status.ABERTA) {
            throw new IllegalArgumentException("Essa solicitacao ja foi processada.");
        }
    }

    private String montarObservacaoInterna(SolicitacaoCancelamento solicitacao) {
        StringBuilder builder = new StringBuilder("Cancelada apos solicitacao do aluno.");
        builder.append(" Motivo: ").append(solicitacao.getMotivo()).append(".");
        if (StringUtils.hasText(solicitacao.getObservacaoAluno())) {
            builder.append(" Observacao do aluno: ").append(solicitacao.getObservacaoAluno()).append(".");
        }
        return builder.toString();
    }

    private String normalizarTexto(String valor) {
        if (!StringUtils.hasText(valor)) {
            return null;
        }
        return valor.trim();
    }
}
