package com.edupercurso.service;

import com.edupercurso.dto.PedidoDTO;
import com.edupercurso.entity.Assinatura;
import com.edupercurso.entity.LocalProva;
import com.edupercurso.entity.Pedido;
import com.edupercurso.entity.Plano;
import com.edupercurso.entity.SolicitacaoCancelamento;
import com.edupercurso.entity.Usuario;
import com.edupercurso.repository.PedidoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PedidoService {

    private final PedidoRepository pedidoRepository;
    private final UsuarioLookupService usuarioLookupService;
    private final PlanoService planoService;
    private final LocalProvaService localProvaService;
    private final AssinaturaService assinaturaService;
    private final MercadoPagoService mercadoPagoService;
    private final SolicitacaoCancelamentoService solicitacaoCancelamentoService;

    public List<PedidoDTO.Response> listarMeus(String email) {
        Usuario usuario = usuarioLookupService.buscarPorEmail(email);
        return montarRespostas(pedidoRepository.findByUsuarioIdOrderByCriadoEmDesc(usuario.getId()));
    }

    public List<PedidoDTO.Response> listarTodos() {
        return montarRespostas(pedidoRepository.findAllByOrderByCriadoEmDesc());
    }

    @Transactional
    public PedidoDTO.Response criarPedidoAluno(String email, PedidoDTO.CreateRequest request) {
        Usuario usuario = usuarioLookupService.buscarPorEmail(email);
        Plano plano = planoService.buscarEntidadePorId(request.getPlanoId());

        validarPlanoDisponivel(plano);
        validarSemAcessoAtivo(usuario, plano);
        validarSemPedidoPendente(usuario, plano);

        Pedido pedido = Pedido.builder()
                .usuario(usuario)
                .plano(plano)
                .localProva(plano.getLocalProva())
                .valorCentavos(plano.getPrecoCentavos())
                .referencia(gerarReferencia())
                .metodoPagamento(Pedido.MetodoPagamento.MERCADO_PAGO)
                .status(Pedido.Status.PENDENTE)
                .build();

        pedido = pedidoRepository.save(pedido);

        MercadoPagoService.CheckoutPreference checkout = mercadoPagoService.criarPreferencia(pedido);
        pedido.setCheckoutId(checkout.id());
        pedido.setCheckoutUrl(checkout.checkoutUrl());

        return PedidoDTO.Response.from(pedidoRepository.save(pedido));
    }

    @Transactional
    public PedidoDTO.Response sincronizarRetorno(String email, PedidoDTO.SyncRequest request) {
        Usuario usuario = usuarioLookupService.buscarPorEmail(email);
        Pedido pedido = pedidoRepository.findByReferenciaAndUsuarioId(request.getExternalReference(), usuario.getId())
                .orElseThrow(() -> new IllegalArgumentException("Pedido nao encontrado para esse retorno."));

        processarPagamentoInterno(request.getPaymentId(), pedido);
        return PedidoDTO.Response.from(pedidoRepository.save(pedido));
    }

    @Transactional
    public void processarPagamentoMercadoPago(String paymentId) {
        MercadoPagoService.PaymentDetails payment = mercadoPagoService.consultarPagamento(paymentId);
        if (!StringUtils.hasText(payment.externalReference())) {
            throw new IllegalArgumentException("Pagamento sem referencia externa.");
        }

        Pedido pedido = pedidoRepository.findByReferencia(payment.externalReference())
                .orElseThrow(() -> new IllegalArgumentException("Pedido nao encontrado para a referencia informada."));

        processarPagamentoInterno(paymentId, pedido, payment);
        pedidoRepository.save(pedido);
    }

    @Transactional
    public void cancelarMeu(String email, UUID id) {
        Usuario usuario = usuarioLookupService.buscarPorEmail(email);
        Pedido pedido = pedidoRepository.findByIdAndUsuarioId(id, usuario.getId())
                .orElseThrow(() -> new IllegalArgumentException("Pedido nao encontrado."));
        cancelarInterno(pedido);
    }

    @Transactional
    public void cancelar(UUID id) {
        cancelarInterno(buscarEntidade(id));
    }

    public Pedido buscarEntidade(UUID id) {
        return pedidoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Pedido nao encontrado."));
    }

    private void processarPagamentoInterno(String paymentId, Pedido pedido) {
        processarPagamentoInterno(paymentId, pedido, null);
    }

    private void processarPagamentoInterno(String paymentId, Pedido pedido, MercadoPagoService.PaymentDetails paymentExistente) {
        MercadoPagoService.PaymentDetails payment = paymentExistente == null
                ? mercadoPagoService.consultarPagamento(paymentId)
                : paymentExistente;

        if (!pedido.getReferencia().equals(payment.externalReference())) {
            throw new IllegalArgumentException("O pagamento nao corresponde ao pedido informado.");
        }

        validarValorSeDisponivel(pedido, payment.transactionAmount());
        atualizarDadosPagamento(pedido, payment);

        if ("approved".equalsIgnoreCase(payment.status()) && pedido.getStatus() != Pedido.Status.PAGO) {
            LocalDateTime inicio = payment.approvedAt() == null ? LocalDateTime.now() : payment.approvedAt();
            Assinatura assinatura = assinaturaService.criarAssinaturaPaga(pedido.getUsuario(), pedido.getPlano(), inicio);
            pedido.setAssinatura(assinatura);
            pedido.setPagoEm(inicio);
            pedido.setStatus(Pedido.Status.PAGO);
        }
    }

    private void atualizarDadosPagamento(Pedido pedido, MercadoPagoService.PaymentDetails payment) {
        pedido.setPaymentId(payment.id());
        pedido.setPaymentType(payment.paymentType());
        pedido.setPaymentStatus(payment.status());
        pedido.setPaymentStatusDetail(payment.statusDetail());
    }

    private void validarValorSeDisponivel(Pedido pedido, BigDecimal valorTransacao) {
        if (valorTransacao == null) {
            return;
        }
        BigDecimal valorPedido = BigDecimal.valueOf(pedido.getValorCentavos()).divide(BigDecimal.valueOf(100));
        if (valorPedido.compareTo(valorTransacao) != 0) {
            throw new IllegalArgumentException("Valor do pagamento diferente do valor do pedido.");
        }
    }

    private void cancelarInterno(Pedido pedido) {
        if (pedido.getStatus() != Pedido.Status.PENDENTE) {
            throw new IllegalArgumentException("Apenas pedidos pendentes podem ser cancelados.");
        }
        pedido.setStatus(Pedido.Status.CANCELADO);
        pedidoRepository.save(pedido);
    }

    private List<PedidoDTO.Response> montarRespostas(List<Pedido> pedidos) {
        if (pedidos.isEmpty()) {
            return List.of();
        }

        LocalDateTime agora = LocalDateTime.now();
        var solicitacoesPorPedido = solicitacaoCancelamentoService.mapearPorPedidoIds(
                pedidos.stream().map(Pedido::getId).toList()
        );

        return pedidos.stream()
                .map(pedido -> {
                    SolicitacaoCancelamento solicitacao = solicitacoesPorPedido.get(pedido.getId());
                    return PedidoDTO.Response.from(
                            pedido,
                            solicitacao,
                            solicitacaoCancelamentoService.podeSolicitarCancelamento(pedido, solicitacao, agora),
                            solicitacaoCancelamentoService.calcularPrazoCancelamento(pedido)
                    );
                })
                .toList();
    }

    private void validarPlanoDisponivel(Plano plano) {
        if (!plano.isAtivo()) {
            throw new IllegalArgumentException("Esse plano nao esta disponivel no momento.");
        }

        LocalProva localProva = plano.getLocalProva();
        if (!localProva.isAtivo()) {
            throw new IllegalArgumentException("Esse local de prova nao esta disponivel no momento.");
        }

        if (localProvaService.permiteCompra(localProva)) {
            return;
        }

        if (localProva.getStatusComercial() == LocalProva.StatusComercial.EM_BREVE) {
            throw new IllegalArgumentException("Esse local de prova ainda nao esta disponivel para compra.");
        }

        if (localProva.getStatusComercial() == LocalProva.StatusComercial.PAUSADO) {
            throw new IllegalArgumentException("As vendas desse local de prova estao temporariamente pausadas.");
        }

        throw new IllegalArgumentException("Esse local de prova nao esta disponivel para compra.");
    }

    private void validarSemAcessoAtivo(Usuario usuario, Plano plano) {
        if (assinaturaService.possuiAssinaturaAtiva(usuario.getId(), plano.getLocalProva().getId())) {
            throw new IllegalArgumentException("Voce ja possui acesso ativo para esse local de prova.");
        }
    }

    private void validarSemPedidoPendente(Usuario usuario, Plano plano) {
        if (pedidoRepository.existsByUsuarioIdAndLocalProvaIdAndStatus(
                usuario.getId(),
                plano.getLocalProva().getId(),
                Pedido.Status.PENDENTE
        )) {
            throw new IllegalArgumentException("Voce ja possui um pedido pendente para esse local de prova.");
        }
    }

    private String gerarReferencia() {
        String timestamp = DateTimeFormatter.ofPattern("yyMMddHHmm", Locale.ROOT).format(LocalDateTime.now());
        String sufixo = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase(Locale.ROOT);
        return "EDP-" + timestamp + "-" + sufixo;
    }
}
