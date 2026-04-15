package com.edupercurso.service;

import com.edupercurso.entity.Assinatura;
import com.edupercurso.entity.Percurso;
import com.edupercurso.entity.Usuario;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.List;

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

        List<Assinatura> assinaturasAtivas = assinaturaService.listarAtivas(usuario.getId());
        return podeAcessarComAssinaturas(percurso, assinaturasAtivas);
    }

    public boolean podeAcessarNaListagem(Percurso percurso, List<Assinatura> assinaturasAtivas) {
        if (!percurso.isAtivo()) {
            return false;
        }

        return podeAcessarComAssinaturas(percurso, assinaturasAtivas);
    }

    public void validarAcesso(Usuario usuario, Percurso percurso) {
        if (!podeAcessar(usuario, percurso)) {
            throw new AccessDeniedException("Voce nao possui acesso a esse conteudo.");
        }
    }

    private boolean podeAcessarComAssinaturas(Percurso percurso, List<Assinatura> assinaturasAtivas) {
        if (assinaturasAtivas == null || assinaturasAtivas.isEmpty()) {
            return false;
        }

        if (percurso.getLocalProva() == null) {
            return true;
        }

        return assinaturasAtivas.stream()
                .anyMatch(assinatura -> assinatura.getLocalProva() != null
                        && percurso.getLocalProva().getId().equals(assinatura.getLocalProva().getId()));
    }
}
