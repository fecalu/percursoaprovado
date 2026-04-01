package com.edupercurso.service;

import com.edupercurso.dto.AdminUsuarioDTO;
import com.edupercurso.entity.Usuario;
import com.edupercurso.repository.AssinaturaRepository;
import com.edupercurso.repository.PasswordResetTokenRepository;
import com.edupercurso.repository.PedidoRepository;
import com.edupercurso.repository.ProgressoRepository;
import com.edupercurso.repository.RespostaQuestaoAlunoRepository;
import com.edupercurso.repository.SolicitacaoCancelamentoRepository;
import com.edupercurso.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminUsuarioService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final RespostaQuestaoAlunoRepository respostaQuestaoAlunoRepository;
    private final ProgressoRepository progressoRepository;
    private final SolicitacaoCancelamentoRepository solicitacaoCancelamentoRepository;
    private final PedidoRepository pedidoRepository;
    private final AssinaturaRepository assinaturaRepository;

    @Transactional(readOnly = true)
    public AdminUsuarioDTO.ListResponse listarAlunos(String busca) {
        String buscaNormalizada = normalizarBusca(busca);
        List<Usuario> usuarios = usuarioRepository.buscarAdmin(Usuario.Role.ALUNO, buscaNormalizada);
        List<UUID> usuarioIds = usuarios.stream().map(Usuario::getId).toList();

        Set<UUID> usuariosComPedidos = usuarioIds.isEmpty()
                ? Set.of()
                : pedidoRepository.findUsuarioIdsComPedidos(usuarioIds).stream().collect(Collectors.toSet());
        Set<UUID> usuariosComAssinaturas = usuarioIds.isEmpty()
                ? Set.of()
                : assinaturaRepository.findUsuarioIdsComAssinaturas(usuarioIds).stream().collect(Collectors.toSet());

        List<AdminUsuarioDTO.ListItem> itens = usuarios.stream()
                .map(usuario -> AdminUsuarioDTO.ListItem.builder()
                        .id(usuario.getId())
                        .nome(usuario.getNome())
                        .email(usuario.getEmail())
                        .authProvider(usuario.getAuthProvider())
                        .emailVerificado(usuario.isEmailVerificado())
                        .criadoEm(usuario.getCriadoEm())
                        .possuiPedidos(usuariosComPedidos.contains(usuario.getId()))
                        .possuiAssinaturas(usuariosComAssinaturas.contains(usuario.getId()))
                        .build())
                .toList();

        long comAssinatura = itens.stream().filter(AdminUsuarioDTO.ListItem::isPossuiAssinaturas).count();
        long comPedido = itens.stream().filter(AdminUsuarioDTO.ListItem::isPossuiPedidos).count();
        long somenteCadastro = itens.stream()
                .filter(item -> !item.isPossuiPedidos() && !item.isPossuiAssinaturas())
                .count();

        return AdminUsuarioDTO.ListResponse.builder()
                .usuarios(itens)
                .resumo(AdminUsuarioDTO.Summary.builder()
                        .totalAlunos(itens.size())
                        .somenteCadastro(somenteCadastro)
                        .comPedido(comPedido)
                        .comAssinatura(comAssinatura)
                        .build())
                .build();
    }

    @Transactional
    public AdminUsuarioDTO.DeleteTestAlunoResponse excluirAlunoTeste(String email, String adminEmail) {
        String emailNormalizado = normalizarEmail(email);
        String adminNormalizado = normalizarEmail(adminEmail);

        Usuario usuario = usuarioRepository.findByEmailIgnoreCase(emailNormalizado)
                .orElseThrow(() -> new IllegalArgumentException("Aluno não encontrado para esse e-mail."));

        if (usuario.getRole() != Usuario.Role.ALUNO) {
            throw new IllegalArgumentException("Essa ferramenta exclui apenas contas de aluno.");
        }

        if (emailNormalizado.equals(adminNormalizado)) {
            throw new IllegalArgumentException("Você não pode excluir a própria conta por essa ferramenta.");
        }

        long tokensExcluidos = passwordResetTokenRepository.countByUsuarioId(usuario.getId());
        long respostasExcluidas = respostaQuestaoAlunoRepository.countByUsuarioId(usuario.getId());
        long progressoExcluido = progressoRepository.countByUsuarioId(usuario.getId());
        long solicitacoesExcluidas = solicitacaoCancelamentoRepository.countByUsuarioId(usuario.getId());
        long pedidosExcluidos = pedidoRepository.countByUsuarioId(usuario.getId());
        long assinaturasExcluidas = assinaturaRepository.countByUsuarioId(usuario.getId());

        passwordResetTokenRepository.deleteAllByUsuarioId(usuario.getId());
        respostaQuestaoAlunoRepository.deleteAllByUsuarioId(usuario.getId());
        progressoRepository.deleteAllByUsuarioId(usuario.getId());
        solicitacaoCancelamentoRepository.deleteAllByUsuarioId(usuario.getId());
        pedidoRepository.deleteAllByUsuarioId(usuario.getId());
        assinaturaRepository.deleteAllByUsuarioId(usuario.getId());
        usuarioRepository.delete(usuario);

        return AdminUsuarioDTO.DeleteTestAlunoResponse.builder()
                .mensagem("Aluno de teste excluído com sucesso.")
                .email(emailNormalizado)
                .tokensExcluidos(tokensExcluidos)
                .respostasExcluidas(respostasExcluidas)
                .progressoExcluido(progressoExcluido)
                .solicitacoesExcluidas(solicitacoesExcluidas)
                .pedidosExcluidos(pedidosExcluidos)
                .assinaturasExcluidas(assinaturasExcluidas)
                .build();
    }

    private String normalizarEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizarBusca(String busca) {
        return busca == null ? "" : busca.trim().toLowerCase(Locale.ROOT);
    }
}
