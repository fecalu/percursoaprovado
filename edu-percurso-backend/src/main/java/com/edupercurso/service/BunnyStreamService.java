package com.edupercurso.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;
import java.util.Set;

@Service
public class BunnyStreamService {

    private static final String API_BASE_URL = "https://video.bunnycdn.com";
    private static final Set<String> VIDEO_EXTENSOES_SUPORTADAS = Set.of(
            ".mp4",
            ".mov",
            ".webm",
            ".m4v",
            ".avi",
            ".mkv"
    );

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Value("${app.video.bunny.library-id:}")
    private String bunnyLibraryId;

    @Value("${app.video.bunny.api-key:}")
    private String bunnyApiKey;

    public BunnyStreamService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
    }

    public UploadedBunnyVideo uploadVideo(MultipartFile file, String titulo) {
        validarConfiguracao();
        validarVideo(file);

        String tituloNormalizado = resolverTitulo(titulo, file.getOriginalFilename());
        String videoId = criarVideoNoBunny(tituloNormalizado);
        enviarArquivoParaBunny(file, videoId);

        return new UploadedBunnyVideo(
                videoId,
                buildEmbedUrl(videoId),
                tituloNormalizado
        );
    }

    public String buildEmbedUrl(String videoAssetId) {
        String assetId = normalizarTexto(videoAssetId);
        if (assetId == null) {
            throw new IllegalArgumentException("Informe o Video ID do Bunny.");
        }
        if (!StringUtils.hasText(bunnyLibraryId)) {
            throw new IllegalArgumentException("BUNNY_STREAM_LIBRARY_ID nao configurado no servidor.");
        }

        return "https://iframe.mediadelivery.net/embed/" + bunnyLibraryId.trim() + "/" + assetId;
    }

    public String extractVideoId(String videoUrl) {
        String valor = normalizarTexto(videoUrl);
        if (valor == null) {
            return null;
        }

        String semQuery = valor.split("\\?")[0];
        int ultimoSlash = semQuery.lastIndexOf('/');
        if (ultimoSlash < 0 || ultimoSlash == semQuery.length() - 1) {
            return null;
        }

        String videoId = semQuery.substring(ultimoSlash + 1).trim();
        return videoId.isBlank() ? null : videoId;
    }

    private String criarVideoNoBunny(String titulo) {
        try {
            String body = objectMapper.writeValueAsString(new CreateVideoRequest(titulo));
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(API_BASE_URL + "/library/" + bunnyLibraryId.trim() + "/videos"))
                    .timeout(Duration.ofSeconds(30))
                    .header("AccessKey", bunnyApiKey.trim())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("Nao foi possivel criar o video no Bunny Stream.");
            }

            JsonNode json = objectMapper.readTree(response.body());
            String guid = json.path("guid").asText(null);
            if (!StringUtils.hasText(guid)) {
                throw new IllegalStateException("O Bunny Stream nao retornou o ID do video criado.");
            }
            return guid;
        } catch (IOException ex) {
            throw new IllegalStateException("Nao foi possivel interpretar a resposta do Bunny Stream.", ex);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("O envio para o Bunny Stream foi interrompido.", ex);
        }
    }

    private void enviarArquivoParaBunny(MultipartFile file, String videoId) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(API_BASE_URL + "/library/" + bunnyLibraryId.trim() + "/videos/" + videoId))
                    .timeout(Duration.ofMinutes(30))
                    .header("AccessKey", bunnyApiKey.trim())
                    .header("Content-Type", "application/octet-stream")
                    .PUT(HttpRequest.BodyPublishers.ofInputStream(() -> {
                        try {
                            return file.getInputStream();
                        } catch (IOException ex) {
                            throw new UncheckedIOException(ex);
                        }
                    }))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("Nao foi possivel enviar o arquivo de video para o Bunny Stream.");
            }

            JsonNode json = objectMapper.readTree(response.body());
            if (!json.path("success").asBoolean(false)) {
                throw new IllegalStateException("O Bunny Stream rejeitou o upload do video.");
            }
        } catch (UncheckedIOException ex) {
            throw new IllegalStateException("Nao foi possivel ler o arquivo enviado para o Bunny Stream.", ex.getCause());
        } catch (IOException ex) {
            throw new IllegalStateException("Nao foi possivel interpretar a resposta do upload no Bunny Stream.", ex);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("O upload do video para o Bunny Stream foi interrompido.", ex);
        }
    }

    private void validarConfiguracao() {
        if (!StringUtils.hasText(bunnyLibraryId)) {
            throw new IllegalArgumentException("BUNNY_STREAM_LIBRARY_ID nao configurado no servidor.");
        }
        if (!StringUtils.hasText(bunnyApiKey)) {
            throw new IllegalArgumentException("BUNNY_STREAM_API_KEY nao configurado no servidor.");
        }
    }

    private void validarVideo(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Selecione um video para enviar.");
        }

        String contentType = normalizarTexto(file.getContentType());
        if (contentType != null && contentType.toLowerCase(Locale.ROOT).startsWith("video/")) {
            return;
        }

        String nomeOriginal = normalizarTexto(file.getOriginalFilename());
        if (nomeOriginal != null) {
            String nomeMinusculo = nomeOriginal.toLowerCase(Locale.ROOT);
            boolean extensaoValida = VIDEO_EXTENSOES_SUPORTADAS.stream().anyMatch(nomeMinusculo::endsWith);
            if (extensaoValida) {
                return;
            }
        }

        throw new IllegalArgumentException("Formato invalido. Envie um video MP4, MOV, WEBM, M4V, AVI ou MKV.");
    }

    private String resolverTitulo(String titulo, String originalFilename) {
        String tituloNormalizado = normalizarTexto(titulo);
        if (tituloNormalizado != null) {
            return tituloNormalizado;
        }

        String nomeOriginal = normalizarTexto(originalFilename);
        if (nomeOriginal == null) {
            return "Video de percurso";
        }

        int ultimoPonto = nomeOriginal.lastIndexOf('.');
        String base = ultimoPonto > 0 ? nomeOriginal.substring(0, ultimoPonto) : nomeOriginal;
        return base.isBlank() ? "Video de percurso" : base.trim();
    }

    private String normalizarTexto(String valor) {
        if (valor == null) {
            return null;
        }
        String texto = valor.trim();
        return texto.isBlank() ? null : texto;
    }

    private record CreateVideoRequest(String title) {
    }

    public record UploadedBunnyVideo(String videoId, String embedUrl, String title) {
    }
}
