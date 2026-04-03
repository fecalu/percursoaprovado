package com.edupercurso.config;

import com.edupercurso.security.JwtFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtFilter jwtFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                        .requestMatchers("/auth/**").permitAll()
                        .requestMatchers("/mercadopago/webhook").permitAll()
                        .requestMatchers(HttpMethod.GET, "/media/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/configuracoes-site/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/locais-prova/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/planos/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/admin/configuracoes-site/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/admin/configuracoes-site/**").hasRole("ADMIN")
                        .requestMatchers("/pedidos/**").hasRole("ALUNO")
                        .requestMatchers(HttpMethod.GET, "/admin/pedidos/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/admin/cancelamentos/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/admin/assinaturas/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/admin/questoes/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/admin/grupos-acesso/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/admin/pedidos/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/admin/cancelamentos/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/admin/questoes/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/admin/grupos-acesso/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/admin/questoes/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/admin/grupos-acesso/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/admin/questoes/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/admin/grupos-acesso/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/uploads/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/locais-prova/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/locais-prova/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/locais-prova/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/planos/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/planos/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/planos/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/admin/assinaturas/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/percursos/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/categorias").authenticated()
                        .requestMatchers(HttpMethod.GET, "/questoes/**").hasRole("ALUNO")
                        .requestMatchers(HttpMethod.POST, "/questoes/**").hasRole("ALUNO")
                        .requestMatchers(HttpMethod.POST, "/percursos/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/percursos/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/percursos/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/categorias/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/categorias/**").hasRole("ADMIN")
                        .requestMatchers("/progresso/**").hasRole("ALUNO")
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
