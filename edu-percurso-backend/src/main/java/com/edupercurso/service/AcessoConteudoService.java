package com.edupercurso.service;

import com.edupercurso.entity.Percurso;
import com.edupercurso.entity.Usuario;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AcessoConteudoService {

    private final AssinaturaService assinaturaService;

    public boolean podeAcessar(Usuario usuario, Percurso percurso) {
        if (usuario.getRole() == Usuario.Role.ADMIN) {
            return true;
        }

        if (!percurso.isAtivo()) {
            return false;
        }

        if (percurso.getLocalProva() == null) {
            return assinaturaService.possuiQualquerAssinaturaAtiva(usuario.getId());
        }

        return assinaturaService.possuiAssinaturaAtiva(usuario.getId(), percurso.getLocalProva().getId());
    }

    public void validarAcesso(Usuario usuario, Percurso percurso) {
        if (!podeAcessar(usuario, percurso)) {
            throw new AccessDeniedException("Voce nao possui acesso a esse conteudo.");
        }
    }
}
