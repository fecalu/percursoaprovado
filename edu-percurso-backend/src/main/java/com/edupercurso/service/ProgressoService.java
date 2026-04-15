package com.edupercurso.service;

import com.edupercurso.dto.ProgressoDTO;
import com.edupercurso.entity.ProgressoAluno;
import com.edupercurso.entity.Usuario;
import com.edupercurso.repository.ProgressoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ProgressoService {

    private final ProgressoRepository progressoRepository;
    private final UsuarioLookupService usuarioLookupService;
    private final PercursoService percursoService;
    private final AcessoConteudoService acessoConteudoService;

    public List<ProgressoDTO.Response> listarMeuProgresso(String email) {
        Usuario usuario = usuarioLookupService.buscarPorEmail(email);
        return progressoRepository.findByUsuarioId(usuario.getId())
                .stream()
                .filter(progresso -> acessoConteudoService.podeAcessar(usuario, progresso.getPercurso()))
                .map(ProgressoDTO.Response::from)
                .toList();
    }

    @Transactional
    public ProgressoDTO.Response salvar(String email, ProgressoDTO.Request request) {
        Usuario usuario = usuarioLookupService.buscarPorEmail(email);
        var percurso = percursoService.buscarEntidadePorId(request.getPercursoId());
        acessoConteudoService.validarAcesso(usuario, percurso);

        ProgressoAluno progresso = progressoRepository
                .findByUsuarioIdAndPercursoId(usuario.getId(), percurso.getId())
                .orElseGet(() -> ProgressoAluno.builder()
                        .usuario(usuario)
                        .percurso(percurso)
                        .build());

        int segundosAssistidos = normalizarSegundosAssistidos(
                request.getSegundosAssistidos(),
                percurso.getDuracaoSegundos()
        );
        int segundosAtuais = progresso.getSegundosAssistidos() == null ? 0 : progresso.getSegundosAssistidos();

        if (segundosAssistidos > segundosAtuais) {
            progresso.setSegundosAssistidos(segundosAssistidos);
        } else if (progresso.getSegundosAssistidos() == null) {
            progresso.setSegundosAssistidos(segundosAtuais);
        }

        if (request.isConcluido()) {
            progresso.setConcluido(true);
        }
        progresso.setUltimaVez(LocalDateTime.now());

        return ProgressoDTO.Response.from(progressoRepository.save(progresso));
    }

    private int normalizarSegundosAssistidos(Integer segundosAssistidos, Integer duracaoSegundos) {
        int segundos = Math.max(0, segundosAssistidos == null ? 0 : segundosAssistidos);
        if (duracaoSegundos == null || duracaoSegundos <= 0) {
            return segundos;
        }
        return Math.min(segundos, duracaoSegundos);
    }
}
