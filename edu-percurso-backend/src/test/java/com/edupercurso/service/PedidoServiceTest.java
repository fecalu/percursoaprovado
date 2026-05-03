package com.edupercurso.service;

import com.edupercurso.dto.PedidoDTO;
import com.edupercurso.entity.Assinatura;
import com.edupercurso.entity.LocalProva;
import com.edupercurso.entity.Pedido;
import com.edupercurso.entity.Plano;
import com.edupercurso.entity.Trilha;
import com.edupercurso.entity.Usuario;
import com.edupercurso.repository.PedidoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PedidoServiceTest {

    @Mock
    private PedidoRepository pedidoRepository;

    @Mock
    private UsuarioLookupService usuarioLookupService;

    @Mock
    private PlanoService planoService;

    @Mock
    private LocalProvaService localProvaService;

    @Mock
    private AssinaturaService assinaturaService;

    @Mock
    private MercadoPagoService mercadoPagoService;

    @Mock
    private SolicitacaoCancelamentoService solicitacaoCancelamentoService;

    @InjectMocks
    private PedidoService pedidoService;

    @Test
    void criarPedidoAlunoPermiteRenovacaoDentroDaJanela() {
        Usuario usuario = criarUsuario();
        Plano plano = criarPlano();
        Assinatura assinaturaAtiva = Assinatura.builder()
                .id(UUID.randomUUID())
                .usuario(usuario)
                .plano(plano)
                .localProva(plano.getLocalProva())
                .inicioEm(LocalDateTime.now().minusDays(25))
                .fimEm(LocalDateTime.now().plusDays(5))
                .status(Assinatura.Status.ATIVA)
                .paymentStatus(Assinatura.PaymentStatus.PAGO)
                .origem(Assinatura.Origem.CHECKOUT)
                .build();
        PedidoDTO.CreateRequest request = new PedidoDTO.CreateRequest();
        request.setPlanoId(plano.getId());

        when(usuarioLookupService.buscarPorEmail(usuario.getEmail())).thenReturn(usuario);
        when(planoService.buscarEntidadePorId(plano.getId())).thenReturn(plano);
        when(localProvaService.permiteCompra(plano.getLocalProva())).thenReturn(true);
        when(assinaturaService.possuiRenovacaoFutura(eq(usuario.getId()), eq(plano.getLocalProva().getId()), any(LocalDateTime.class)))
                .thenReturn(false);
        when(assinaturaService.buscarAssinaturaAtivaAtual(eq(usuario.getId()), eq(plano.getLocalProva().getId()), any(LocalDateTime.class)))
                .thenReturn(Optional.of(assinaturaAtiva));
        when(assinaturaService.estaNaJanelaDeRenovacao(eq(assinaturaAtiva), any(LocalDateTime.class))).thenReturn(true);
        when(pedidoRepository.existsByUsuarioIdAndLocalProvaIdAndStatus(
                usuario.getId(),
                plano.getLocalProva().getId(),
                Pedido.Status.PENDENTE
        )).thenReturn(false);
        when(pedidoRepository.save(any(Pedido.class))).thenAnswer(invocation -> {
            Pedido pedido = invocation.getArgument(0);
            if (pedido.getId() == null) {
                pedido.setId(UUID.randomUUID());
            }
            if (pedido.getCriadoEm() == null) {
                pedido.setCriadoEm(LocalDateTime.now());
            }
            return pedido;
        });
        when(mercadoPagoService.criarPreferencia(any(Pedido.class)))
                .thenReturn(new MercadoPagoService.CheckoutPreference("chk_123", "https://checkout.example/123"));

        PedidoDTO.Response response = pedidoService.criarPedidoAluno(usuario.getEmail(), request);

        assertThat(response.getCheckoutUrl()).isEqualTo("https://checkout.example/123");
        verify(mercadoPagoService).criarPreferencia(any(Pedido.class));
    }

    @Test
    void criarPedidoAlunoBloqueiaRenovacaoForaDaJanela() {
        Usuario usuario = criarUsuario();
        Plano plano = criarPlano();
        Assinatura assinaturaAtiva = Assinatura.builder()
                .id(UUID.randomUUID())
                .usuario(usuario)
                .plano(plano)
                .localProva(plano.getLocalProva())
                .inicioEm(LocalDateTime.now().minusDays(10))
                .fimEm(LocalDateTime.now().plusDays(25))
                .status(Assinatura.Status.ATIVA)
                .paymentStatus(Assinatura.PaymentStatus.PAGO)
                .origem(Assinatura.Origem.CHECKOUT)
                .build();
        PedidoDTO.CreateRequest request = new PedidoDTO.CreateRequest();
        request.setPlanoId(plano.getId());

        when(usuarioLookupService.buscarPorEmail(usuario.getEmail())).thenReturn(usuario);
        when(planoService.buscarEntidadePorId(plano.getId())).thenReturn(plano);
        when(localProvaService.permiteCompra(plano.getLocalProva())).thenReturn(true);
        when(assinaturaService.possuiRenovacaoFutura(eq(usuario.getId()), eq(plano.getLocalProva().getId()), any(LocalDateTime.class)))
                .thenReturn(false);
        when(assinaturaService.buscarAssinaturaAtivaAtual(eq(usuario.getId()), eq(plano.getLocalProva().getId()), any(LocalDateTime.class)))
                .thenReturn(Optional.of(assinaturaAtiva));
        when(assinaturaService.estaNaJanelaDeRenovacao(eq(assinaturaAtiva), any(LocalDateTime.class))).thenReturn(false);

        assertThatThrownBy(() -> pedidoService.criarPedidoAluno(usuario.getEmail(), request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ultimos 15 dias");
    }

    @Test
    void sincronizarRetornoCriaAssinaturaFuturaQuandoPagamentoAprovaRenovacao() {
        Usuario usuario = criarUsuario();
        Plano plano = criarPlano();
        LocalDateTime aprovadoEm = LocalDateTime.now();
        LocalDateTime inicioAgendado = aprovadoEm.plusDays(4);
        Assinatura assinatura = Assinatura.builder()
                .id(UUID.randomUUID())
                .usuario(usuario)
                .plano(plano)
                .localProva(plano.getLocalProva())
                .inicioEm(inicioAgendado)
                .fimEm(inicioAgendado.plusDays(plano.getDuracaoDias()))
                .status(Assinatura.Status.ATIVA)
                .paymentStatus(Assinatura.PaymentStatus.PAGO)
                .origem(Assinatura.Origem.CHECKOUT)
                .build();
        Pedido pedido = Pedido.builder()
                .id(UUID.randomUUID())
                .usuario(usuario)
                .plano(plano)
                .localProva(plano.getLocalProva())
                .valorCentavos(plano.getPrecoCentavos())
                .referencia("EDP-TESTE-001")
                .metodoPagamento(Pedido.MetodoPagamento.MERCADO_PAGO)
                .status(Pedido.Status.PENDENTE)
                .criadoEm(LocalDateTime.now().minusDays(1))
                .build();
        PedidoDTO.SyncRequest request = new PedidoDTO.SyncRequest();
        request.setPaymentId("pay_123");
        request.setExternalReference(pedido.getReferencia());

        when(usuarioLookupService.buscarPorEmail(usuario.getEmail())).thenReturn(usuario);
        when(pedidoRepository.findByReferenciaAndUsuarioId(pedido.getReferencia(), usuario.getId())).thenReturn(Optional.of(pedido));
        when(mercadoPagoService.consultarPagamento("pay_123")).thenReturn(new MercadoPagoService.PaymentDetails(
                "pay_123",
                "approved",
                "accredited",
                "credit_card",
                pedido.getReferencia(),
                BigDecimal.valueOf(plano.getPrecoCentavos()).divide(BigDecimal.valueOf(100)),
                aprovadoEm
        ));
        when(assinaturaService.calcularInicioParaNovoCheckout(
                usuario.getId(),
                plano.getLocalProva().getId(),
                pedido.getCriadoEm(),
                aprovadoEm
        )).thenReturn(inicioAgendado);
        when(assinaturaService.criarAssinaturaPaga(usuario, plano, inicioAgendado)).thenReturn(assinatura);
        when(pedidoRepository.save(any(Pedido.class))).thenAnswer(invocation -> invocation.getArgument(0));

        pedidoService.sincronizarRetorno(usuario.getEmail(), request);

        ArgumentCaptor<Pedido> captor = ArgumentCaptor.forClass(Pedido.class);
        verify(pedidoRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(Pedido.Status.PAGO);
        assertThat(captor.getValue().getPagoEm()).isEqualTo(aprovadoEm);
        assertThat(captor.getValue().getAssinatura()).isEqualTo(assinatura);
        verify(assinaturaService).criarAssinaturaPaga(usuario, plano, inicioAgendado);
    }

    private Usuario criarUsuario() {
        return Usuario.builder()
                .id(UUID.randomUUID())
                .nome("Aluno Teste")
                .email("aluno@teste.com")
                .authProvider(Usuario.AuthProvider.LOCAL)
                .emailVerificado(true)
                .role(Usuario.Role.ALUNO)
                .build();
    }

    private Plano criarPlano() {
        LocalProva localProva = LocalProva.builder()
                .id(UUID.randomUUID())
                .nome("Cohatrac")
                .slug("cohatrac")
                .ativo(true)
                .statusComercial(LocalProva.StatusComercial.DISPONIVEL)
                .build();
        Trilha trilha = Trilha.builder()
                .id(UUID.randomUUID())
                .codigo("reta_final_prova")
                .nome("Reta final")
                .ativo(true)
                .build();

        return Plano.builder()
                .id(UUID.randomUUID())
                .localProva(localProva)
                .trilhaPrincipal(trilha)
                .nome("Plano 30 dias")
                .duracaoDias(30)
                .precoCentavos(10000)
                .ativo(true)
                .build();
    }
}
