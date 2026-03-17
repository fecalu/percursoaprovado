package com.edupercurso.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.util.StringUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;

@Configuration
public class CorsConfig {

    @Value("${app.base-url:http://localhost}")
    private String appBaseUrl;

    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(buildAllowedOrigins());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return new CorsFilter(source);
    }

    private List<String> buildAllowedOrigins() {
        List<String> origins = new ArrayList<>(List.of(
                "http://localhost:5173",
                "http://127.0.0.1:5173"
        ));

        if (!StringUtils.hasText(appBaseUrl)) {
            return origins;
        }

        origins.add(appBaseUrl);

        try {
            URI uri = URI.create(appBaseUrl);
            String host = uri.getHost();
            String scheme = uri.getScheme();

            if (StringUtils.hasText(host) && StringUtils.hasText(scheme)) {
                if (host.startsWith("www.")) {
                    origins.add(scheme + "://" + host.substring(4));
                } else {
                    origins.add(scheme + "://www." + host);
                }
            }
        } catch (IllegalArgumentException ignored) {
            // Falls back to the explicit APP_BASE_URL value only.
        }

        return origins.stream().distinct().toList();
    }
}
