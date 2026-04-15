package com.edupercurso.dto;

import com.edupercurso.entity.Plano;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public class PlanoDTO {

    @Data
    public static class Request {
        @NotNull
        private UUID localProvaId;
        @NotNull
        private UUID trilhaId;
        @NotBlank
        private String nome;
        @NotNull
        private Integer duracaoDias;
        @NotNull
        private Integer precoCentavos;
        private boolean ativo = true;
        private boolean usarCheckoutPersonalizado = false;
        private String checkoutKicker;
        private String checkoutTitulo;
        private String checkoutSubtitulo;
        private String checkoutBeneficiosTitulo;
        private String checkoutBeneficiosTexto;
        private String checkoutAjudaTitulo;
        private String checkoutAjudaTexto;
        private String checkoutConfiancaTexto;
        private String checkoutResumoKicker;
        private String checkoutResumoTexto;
        private String checkoutPrecoLabel;
        private String checkoutPrecoTexto;
        private String checkoutSeguroTexto;
        private String vitrineSelo;
        private String vitrineResumo;
        private String vitrineTexto;
        private String vitrineMeta;
        private Boolean vitrineRecomendada;
        private List<UUID> gruposAcessoIds;
    }

    @Data
    public static class Response {
        private UUID id;
        private UUID localProvaId;
        private String localProvaNome;
        private String localProvaSlug;
        private UUID trilhaId;
        private String trilhaCodigo;
        private String trilhaNome;
        private String nome;
        private Integer duracaoDias;
        private Integer precoCentavos;
        private boolean ativo;
        private boolean usarCheckoutPersonalizado;
        private String checkoutKicker;
        private String checkoutTitulo;
        private String checkoutSubtitulo;
        private String checkoutBeneficiosTitulo;
        private String checkoutBeneficiosTexto;
        private String checkoutAjudaTitulo;
        private String checkoutAjudaTexto;
        private String checkoutConfiancaTexto;
        private String checkoutResumoKicker;
        private String checkoutResumoTexto;
        private String checkoutPrecoLabel;
        private String checkoutPrecoTexto;
        private String checkoutSeguroTexto;
        private String vitrineSelo;
        private String vitrineResumo;
        private String vitrineTexto;
        private String vitrineMeta;
        private Boolean vitrineRecomendada;
        private List<UUID> gruposAcessoIds;
        private List<String> gruposAcessoNomes;
        private LocalDateTime criadoEm;

        public static Response from(Plano plano) {
            Response response = new Response();
            List<com.edupercurso.entity.GrupoAcesso> gruposOrdenados = plano.getGruposAcesso() == null
                    ? List.of()
                    : plano.getGruposAcesso().stream()
                    .sorted((a, b) -> {
                        int ordemA = a.getOrdemExibicao() == null ? Integer.MAX_VALUE : a.getOrdemExibicao();
                        int ordemB = b.getOrdemExibicao() == null ? Integer.MAX_VALUE : b.getOrdemExibicao();
                        if (ordemA != ordemB) {
                            return Integer.compare(ordemA, ordemB);
                        }
                        return a.getNome().compareToIgnoreCase(b.getNome());
                    })
                    .toList();

            response.id = plano.getId();
            response.localProvaId = plano.getLocalProva().getId();
            response.localProvaNome = plano.getLocalProva().getNome();
            response.localProvaSlug = plano.getLocalProva().getSlug();
            response.trilhaId = plano.getTrilhaPrincipal().getId();
            response.trilhaCodigo = plano.getTrilhaPrincipal().getCodigo();
            response.trilhaNome = plano.getTrilhaPrincipal().getNome();
            response.nome = plano.getNome();
            response.duracaoDias = plano.getDuracaoDias();
            response.precoCentavos = plano.getPrecoCentavos();
            response.ativo = plano.isAtivo();
            response.usarCheckoutPersonalizado = plano.isUsarCheckoutPersonalizado();
            response.checkoutKicker = plano.getCheckoutKicker();
            response.checkoutTitulo = plano.getCheckoutTitulo();
            response.checkoutSubtitulo = plano.getCheckoutSubtitulo();
            response.checkoutBeneficiosTitulo = plano.getCheckoutBeneficiosTitulo();
            response.checkoutBeneficiosTexto = plano.getCheckoutBeneficiosTexto();
            response.checkoutAjudaTitulo = plano.getCheckoutAjudaTitulo();
            response.checkoutAjudaTexto = plano.getCheckoutAjudaTexto();
            response.checkoutConfiancaTexto = plano.getCheckoutConfiancaTexto();
            response.checkoutResumoKicker = plano.getCheckoutResumoKicker();
            response.checkoutResumoTexto = plano.getCheckoutResumoTexto();
            response.checkoutPrecoLabel = plano.getCheckoutPrecoLabel();
            response.checkoutPrecoTexto = plano.getCheckoutPrecoTexto();
            response.checkoutSeguroTexto = plano.getCheckoutSeguroTexto();
            response.vitrineSelo = plano.getVitrineSelo();
            response.vitrineResumo = plano.getVitrineResumo();
            response.vitrineTexto = plano.getVitrineTexto();
            response.vitrineMeta = plano.getVitrineMeta();
            response.vitrineRecomendada = plano.getVitrineRecomendada();
            response.gruposAcessoIds = gruposOrdenados.stream().map(com.edupercurso.entity.GrupoAcesso::getId).toList();
            response.gruposAcessoNomes = gruposOrdenados.stream().map(com.edupercurso.entity.GrupoAcesso::getNome).toList();
            response.criadoEm = plano.getCriadoEm();
            return response;
        }
    }
}
