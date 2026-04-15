package com.edupercurso.service;

import com.edupercurso.dto.ProgressoDTO;
import com.edupercurso.entity.Percurso;
import com.edupercurso.entity.ProgressoAluno;
import com.edupercurso.entity.Usuario;
import com.edupercurso.repository.ProgressoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProgressoServiceTest {

    @Mock
    private ProgressoRepository progressoRepository;

    @Mock
    private UsuarioLookupService usuarioLookupService;

    @Mock
    private PercursoService percursoService;

    @Mock
    private AcessoConteudoService acessoConteudoService;

    @InjectMocks
    private ProgressoService progressoService;

    @Test
    void salvarLimitaSegundosAssistidosPelaDuracaoDoConteudo() {
        UUID usuarioId = UUID.randomUUID();
        UUID percursoId = UUID.randomUUID();
        Usuario usuario = Usuario.builder()
                .id(usuarioId)
                .email("aluno@teste.com")
                .role(Usuario.Role.ALUNO)
                .build();
        Percurso percurso = Percurso.builder()
                .id(percursoId)
                .titulo("Aula teste")
                .duracaoSegundos(120)
                .ativo(true)
                .build();
        ProgressoDTO.Request request = new ProgressoDTO.Request();
        request.setPercursoId(percursoId);
        request.setSegundosAssistidos(999);

        when(usuarioLookupService.buscarPorEmail(usuario.getEmail())).thenReturn(usuario);
        when(percursoService.buscarEntidadePorId(percursoId)).thenReturn(percurso);
        when(progressoRepository.findByUsuarioIdAndPercursoId(usuarioId, percursoId)).thenReturn(Optional.empty());
        when(progressoRepository.save(any(ProgressoAluno.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ProgressoDTO.Response response = progressoService.salvar(usuario.getEmail(), request);

        ArgumentCaptor<ProgressoAluno> captor = ArgumentCaptor.forClass(ProgressoAluno.class);
        verify(progressoRepository).save(captor.capture());
        assertThat(captor.getValue().getSegundosAssistidos()).isEqualTo(120);
        assertThat(response.getSegundosAssistidos()).isEqualTo(120);
    }

    @Test
    void salvarNaoGravaSegundosNegativosMesmoSeChamadoDiretamente() {
        UUID usuarioId = UUID.randomUUID();
        UUID percursoId = UUID.randomUUID();
        Usuario usuario = Usuario.builder()
                .id(usuarioId)
                .email("aluno@teste.com")
                .role(Usuario.Role.ALUNO)
                .build();
        Percurso percurso = Percurso.builder()
                .id(percursoId)
                .titulo("Aula teste")
                .duracaoSegundos(120)
                .ativo(true)
                .build();
        ProgressoDTO.Request request = new ProgressoDTO.Request();
        request.setPercursoId(percursoId);
        request.setSegundosAssistidos(-30);

        when(usuarioLookupService.buscarPorEmail(usuario.getEmail())).thenReturn(usuario);
        when(percursoService.buscarEntidadePorId(percursoId)).thenReturn(percurso);
        when(progressoRepository.findByUsuarioIdAndPercursoId(usuarioId, percursoId)).thenReturn(Optional.empty());
        when(progressoRepository.save(any(ProgressoAluno.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ProgressoDTO.Response response = progressoService.salvar(usuario.getEmail(), request);

        assertThat(response.getSegundosAssistidos()).isZero();
    }
}
