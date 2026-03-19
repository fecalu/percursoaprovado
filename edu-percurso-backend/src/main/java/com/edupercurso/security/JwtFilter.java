package com.edupercurso.security;

import com.edupercurso.entity.Usuario;
import com.edupercurso.repository.UsuarioRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JwtFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UsuarioRepository usuarioRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest req,
                                    HttpServletResponse res,
                                    FilterChain chain) throws ServletException, IOException {

        String header = req.getHeader("Authorization");

        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            if (jwtUtil.valido(token)) {
                String email = jwtUtil.extrairEmail(token);
                Usuario usuario = usuarioRepository.findByEmail(email).orElse(null);

                if (usuario != null && tokenAindaValidoDepoisDaSenha(token, usuario)) {
                    var auth = new UsernamePasswordAuthenticationToken(
                            email,
                            null,
                            List.of(new SimpleGrantedAuthority("ROLE_" + usuario.getRole().name()))
                    );
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            }
        }

        chain.doFilter(req, res);
    }

    private boolean tokenAindaValidoDepoisDaSenha(String token, Usuario usuario) {
        if (usuario.getSenhaAlteradaEm() == null) {
            return true;
        }

        LocalDateTime emitidoEm = LocalDateTime.ofInstant(
                jwtUtil.extrairEmitidoEm(token).toInstant(),
                ZoneId.systemDefault()
        );

        return !emitidoEm.isBefore(usuario.getSenhaAlteradaEm());
    }
}
