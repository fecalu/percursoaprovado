package com.edupercurso.repository;

import com.edupercurso.entity.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UsuarioRepository extends JpaRepository<Usuario, UUID> {
    Optional<Usuario> findByEmail(String email);
    Optional<Usuario> findByEmailIgnoreCase(String email);
    Optional<Usuario> findByGoogleSub(String googleSub);
    boolean existsByEmail(String email);
    boolean existsByEmailIgnoreCase(String email);

    @Query("""
            select u
            from Usuario u
            where u.role = :role
              and (
                :busca = ''
                or lower(u.nome) like lower(concat('%', :busca, '%'))
                or lower(u.email) like lower(concat('%', :busca, '%'))
              )
            order by u.criadoEm desc
            """)
    List<Usuario> buscarAdmin(@Param("role") Usuario.Role role, @Param("busca") String busca);
}
