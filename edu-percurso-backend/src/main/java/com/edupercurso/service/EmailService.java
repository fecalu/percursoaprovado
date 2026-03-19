package com.edupercurso.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;
    private final String from;
    private final String username;
    private final String host;

    public EmailService(
            JavaMailSender mailSender,
            @Value("${app.mail.from:}") String from,
            @Value("${spring.mail.username:}") String username,
            @Value("${spring.mail.host:}") String host) {
        this.mailSender = mailSender;
        this.from = from;
        this.username = username;
        this.host = host;
    }

    public void enviarRedefinicaoSenha(String destinatario, String nome, String link, long expiraEmMinutos) {
        if (!estaConfigurado()) {
            log.warn("Servico de e-mail nao configurado; link de redefinicao nao foi enviado para {}", destinatario);
            return;
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(destinatario);
        message.setFrom(StringUtils.hasText(from) ? from : username);
        message.setSubject("Redefinir sua senha - Percurso Aprovado");
        message.setText("""
                Ola, %s!

                Recebemos um pedido para redefinir a senha da sua conta no Percurso Aprovado.

                Use o link abaixo para cadastrar uma nova senha:
                %s

                Esse link expira em %d minutos e pode ser usado apenas uma vez.

                Se voce nao pediu essa redefinicao, pode ignorar este e-mail.
                """.formatted(nome, link, expiraEmMinutos));

        try {
            mailSender.send(message);
        } catch (MailException ex) {
            log.error("Falha ao enviar e-mail de redefinicao para {}", destinatario, ex);
            throw ex;
        }
    }

    public boolean estaConfigurado() {
        return StringUtils.hasText(host) && StringUtils.hasText(username);
    }
}
