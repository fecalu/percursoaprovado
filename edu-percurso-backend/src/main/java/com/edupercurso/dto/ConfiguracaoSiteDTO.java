package com.edupercurso.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class ConfiguracaoSiteDTO {

    @Data
    public static class FaqItem {
        private String pergunta;
        private String resposta;
    }

    @Data
    public static class SaibaMaisItem {
        private String titulo;
        private String copy;
        private List<String> pontos = new ArrayList<>();
    }

    @Data
    public static class HomeConfig {
        private String heroKicker;
        private String heroTitulo;
        private String heroSubtitulo;
        private String heroBotaoPrimarioTexto;
        private String heroBotaoSecundarioTexto;
        private String heroVideoUrl;
        private String heroVideoTitulo;
        private String secaoLocaisTitulo;
        private String secaoLocaisSubtitulo;
        private String faqTitulo;
        private String faqSubtitulo;
        private List<FaqItem> faqItens = new ArrayList<>();
        private String ctaFinalKicker;
        private String ctaFinalTitulo;
        private String ctaFinalTexto;
        private String ctaFinalBotaoPrimarioTexto;
        private String ctaFinalBotaoSecundarioTexto;
    }

    @Data
    public static class LocalPageConfig {
        private String heroFallbackTitulo;
        private String heroFallbackSubtituloDisponivel;
        private String heroFallbackSubtituloIndisponivel;
        private String secaoPlanosTitulo;
        private String secaoPlanosSubtitulo;
        private String secaoPlanosFaixa1;
        private String secaoPlanosFaixa2;
        private String secaoPlanosFaixa3;
        private String boxFallbackTitulo;
        private String boxFallbackItem1;
        private String boxFallbackItem2;
        private String boxFallbackItem3;
        private String boxFallbackObservacao;
        private String saibaMaisTitulo;
        private String saibaMaisSubtitulo;
        private List<SaibaMaisItem> saibaMaisItens = new ArrayList<>();
    }

    @Data
    public static class CheckoutConfig {
        private String kickerPadrao;
        private String tituloPadrao;
        private String subtituloPadrao;
        private String beneficiosTituloPadrao;
        private List<String> beneficiosListaPadrao = new ArrayList<>();
        private String ajudaTituloPadrao;
        private String ajudaTextoPadrao;
        private List<String> confiancaListaPadrao = new ArrayList<>();
        private String resumoKickerPadrao;
        private String resumoTextoPadrao;
        private String precoLabelPadrao;
        private String precoTextoPadrao;
        private String seguroTextoPadrao;
    }

    @Data
    public static class Response {
        private UUID id;
        private HomeConfig home = new HomeConfig();
        private LocalPageConfig localPage = new LocalPageConfig();
        private CheckoutConfig checkout = new CheckoutConfig();
        private LocalDateTime criadoEm;
        private LocalDateTime atualizadoEm;
    }
}
