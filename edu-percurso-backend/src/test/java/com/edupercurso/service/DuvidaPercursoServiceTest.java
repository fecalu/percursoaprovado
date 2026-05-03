package com.edupercurso.service;

import com.edupercurso.dto.DuvidaPercursoDTO;
import com.edupercurso.entity.DuvidaPercurso;
import com.edupercurso.entity.Percurso;
import com.edupercurso.entity.Usuario;
import com.edupercurso.repository.DuvidaPercursoApoioRepository;
import com.edupercurso.repository.DuvidaPercursoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DuvidaPercursoServiceTest {

    @Mock
    private DuvidaPercursoRepository duvidaPercursoRepository;

    @Mock
    private DuvidaPercursoApoioRepository duvidaPercursoApoioRepository;

    @Mock
    private PercursoService percursoService;

    @Mock
    private UsuarioLookupService usuarioLookupService;

    @Mock
    private AcessoConteudoService acessoConteudoService;

    @InjectMocks
    private DuvidaPercursoService duvidaPercursoService;

    @Test
    void criarSalvaDuvidaComoPendenteModeracao() {
        Usuario aluno = criarAluno();
        Percurso percurso = criarPercurso();
        DuvidaPercursoDTO.CreateRequest request = new DuvidaPercursoDTO.CreateRequest();
        request.setTimestampSegundos(94);
        request.setTitulo("  Posso virar o volante aqui? ");
        request.setDescricao("  Fiquei em duvida nesse retorno. ");

        when(usuarioLookupService.buscarPorEmail(aluno.getEmail())).thenReturn(aluno);
        when(percursoService.buscarEntidadePorId(percurso.getId())).thenReturn(percurso);
        when(duvidaPercursoRepository.save(any(DuvidaPercurso.class))).thenAnswer(invocation -> {
            DuvidaPercurso duvida = invocation.getArgument(0);
            duvida.setId(UUID.randomUUID());
            duvida.setCriadaEm(LocalDateTime.now());
            duvida.setAtualizadaEm(LocalDateTime.now());
            return duvida;
        });

        DuvidaPercursoDTO.Response response = duvidaPercursoService.criar(aluno.getEmail(), percurso.getId(), request);

        ArgumentCaptor<DuvidaPercurso> captor = ArgumentCaptor.forClass(DuvidaPercurso.class);
        verify(duvidaPercursoRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(DuvidaPercurso.Status.PENDENTE_MODERACAO);
        assertThat(captor.getValue().getJanelaRelacionadaSegundos()).isEqualTo(5);
        assertThat(captor.getValue().getTitulo()).isEqualTo("Posso virar o volante aqui?");
        assertThat(captor.getValue().getDescricao()).isEqualTo("Fiquei em duvida nesse retorno.");
        assertThat(response.getStatus()).isEqualTo("PENDENTE_MODERACAO");
    }

    @Test
    void atualizarAdminPromoveParaRespondidaQuandoRespostaOficialEInformada() {
        Usuario admin = Usuario.builder()
                .id(UUID.randomUUID())
                .nome("Equipe Pedagogica")
                .email("admin@teste.com")
                .role(Usuario.Role.ADMIN)
                .authProvider(Usuario.AuthProvider.LOCAL)
                .build();
        Usuario aluno = criarAluno();
        Percurso percurso = criarPercurso();
        DuvidaPercurso duvida = DuvidaPercurso.builder()
                .id(UUID.randomUUID())
                .percurso(percurso)
                .usuario(aluno)
                .timestampSegundos(70)
                .titulo("Tenho duvida nesse trecho")
                .descricao("O carro precisa parar totalmente?")
                .status(DuvidaPercurso.Status.PUBLICADA)
                .criadaEm(LocalDateTime.now().minusDays(1))
                .atualizadaEm(LocalDateTime.now().minusHours(2))
                .build();
        DuvidaPercursoDTO.AdminUpdateRequest request = new DuvidaPercursoDTO.AdminUpdateRequest();
        request.setTimestampSegundos(70);
        request.setTitulo("Tenho duvida nesse trecho");
        request.setDescricao("O carro precisa parar totalmente?");
        request.setStatus(DuvidaPercurso.Status.PUBLICADA);
        request.setRespostaOficial("Sim. Nesse ponto o carro precisa imobilizar antes de retomar.");
        request.setJanelaRelacionadaSegundos(5);

        when(usuarioLookupService.buscarPorEmail(admin.getEmail())).thenReturn(admin);
        when(duvidaPercursoRepository.findById(duvida.getId())).thenReturn(Optional.of(duvida));
        when(duvidaPercursoRepository.save(any(DuvidaPercurso.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(duvidaPercursoApoioRepository.contarPorDuvidaIds(List.of(duvida.getId())))
                .thenReturn(List.<Object[]>of(new Object[]{duvida.getId(), 2L}));

        DuvidaPercursoDTO.Response response = duvidaPercursoService.atualizarAdmin(admin.getEmail(), duvida.getId(), request);

        assertThat(response.getStatus()).isEqualTo("RESPONDIDA");
        assertThat(response.getRespostaOficial()).contains("imobilizar");
        assertThat(response.getJanelaRelacionadaSegundos()).isEqualTo(5);
        assertThat(duvida.getRespondidaPor()).isEqualTo(admin);
        assertThat(duvida.getPublicadaEm()).isNotNull();
        assertThat(duvida.getRespostaCriadaEm()).isNotNull();
    }

    private Usuario criarAluno() {
        return Usuario.builder()
                .id(UUID.randomUUID())
                .nome("Joao Felipe")
                .email("aluno@teste.com")
                .role(Usuario.Role.ALUNO)
                .authProvider(Usuario.AuthProvider.LOCAL)
                .emailVerificado(true)
                .build();
    }

    private Percurso criarPercurso() {
        return Percurso.builder()
                .id(UUID.randomUUID())
                .titulo("Percurso central")
                .duracaoSegundos(320)
                .ativo(true)
                .build();
    }
}
