package com.edupercurso.config;

import com.edupercurso.service.StorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class MediaConfig implements WebMvcConfigurer {

    private final StorageService storageService;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/media/**")
                .addResourceLocations(storageService.getMediaRootUri())
                .setCachePeriod(60 * 60 * 24 * 7);
    }
}
