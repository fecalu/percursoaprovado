package com.edupercurso.service;

import com.edupercurso.dto.ConfiguracaoSiteDTO;
import com.edupercurso.entity.ConfiguracaoSite;
import com.edupercurso.repository.ConfiguracaoSiteRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.function.Supplier;

@Service
@RequiredArgsConstructor
public class ConfiguracaoSiteService {

    private final ConfiguracaoSiteRepository configuracaoSiteRepository;
    private final ObjectMapper objectMapper;

    public ConfiguracaoSiteDTO.Response buscarPublica() {
        return configuracaoSiteRepository.findTopByOrderByCriadoEmAsc()
                .map(this::toResponse)
                .orElseGet(this::novaResponseVazia);
    }

    public ConfiguracaoSiteDTO.Response buscarAdmin() {
        return toResponse(buscarOuCriarEntidade());
    }

    @Transactional
    public ConfiguracaoSiteDTO.Response atualizarHome(ConfiguracaoSiteDTO.HomeConfig request) {
        ConfiguracaoSite configuracaoSite = buscarOuCriarEntidade();
        configuracaoSite.setHomeJson(escreverJson(request == null ? new ConfiguracaoSiteDTO.HomeConfig() : request));
        return toResponse(configuracaoSiteRepository.save(configuracaoSite));
    }

    @Transactional
    public ConfiguracaoSiteDTO.Response atualizarLocalPage(ConfiguracaoSiteDTO.LocalPageConfig request) {
        ConfiguracaoSite configuracaoSite = buscarOuCriarEntidade();
        configuracaoSite.setLocalPageJson(escreverJson(request == null ? new ConfiguracaoSiteDTO.LocalPageConfig() : request));
        return toResponse(configuracaoSiteRepository.save(configuracaoSite));
    }

    @Transactional
    public ConfiguracaoSiteDTO.Response atualizarCheckout(ConfiguracaoSiteDTO.CheckoutConfig request) {
        ConfiguracaoSite configuracaoSite = buscarOuCriarEntidade();
        configuracaoSite.setCheckoutJson(escreverJson(request == null ? new ConfiguracaoSiteDTO.CheckoutConfig() : request));
        return toResponse(configuracaoSiteRepository.save(configuracaoSite));
    }

    private ConfiguracaoSite buscarOuCriarEntidade() {
        return configuracaoSiteRepository.findTopByOrderByCriadoEmAsc()
                .orElseGet(() -> configuracaoSiteRepository.save(ConfiguracaoSite.builder().build()));
    }

    private ConfiguracaoSiteDTO.Response toResponse(ConfiguracaoSite entity) {
        ConfiguracaoSiteDTO.Response response = new ConfiguracaoSiteDTO.Response();
        response.setId(entity.getId());
        response.setHome(lerJson(entity.getHomeJson(), ConfiguracaoSiteDTO.HomeConfig.class, ConfiguracaoSiteDTO.HomeConfig::new));
        response.setLocalPage(lerJson(entity.getLocalPageJson(), ConfiguracaoSiteDTO.LocalPageConfig.class, ConfiguracaoSiteDTO.LocalPageConfig::new));
        response.setCheckout(lerJson(entity.getCheckoutJson(), ConfiguracaoSiteDTO.CheckoutConfig.class, ConfiguracaoSiteDTO.CheckoutConfig::new));
        response.setCriadoEm(entity.getCriadoEm());
        response.setAtualizadoEm(entity.getAtualizadoEm());
        return response;
    }

    private ConfiguracaoSiteDTO.Response novaResponseVazia() {
        return new ConfiguracaoSiteDTO.Response();
    }

    private <T> T lerJson(String json, Class<T> clazz, Supplier<T> fallback) {
        if (json == null || json.isBlank()) {
            return fallback.get();
        }

        try {
            return objectMapper.readValue(json, clazz);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Nao foi possivel ler a configuracao do site.", ex);
        }
    }

    private String escreverJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Nao foi possivel salvar a configuracao do site.", ex);
        }
    }
}
