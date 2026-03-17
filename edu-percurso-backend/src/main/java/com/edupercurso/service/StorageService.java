package com.edupercurso.service;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class StorageService {

    private static final Set<String> TIPOS_SUPORTADOS = Set.of(
            "image/jpeg",
            "image/png",
            "image/webp"
    );

    private final Path mediaRoot;
    private final Path thumbnailsDir;

    public StorageService(@Value("${app.storage.path:storage}") String storagePath) {
        this.mediaRoot = Paths.get(storagePath).toAbsolutePath().normalize();
        this.thumbnailsDir = mediaRoot.resolve("thumbnails").normalize();
    }

    @PostConstruct
    public void inicializar() {
        try {
            Files.createDirectories(thumbnailsDir);
        } catch (IOException ex) {
            throw new IllegalStateException("Nao foi possivel preparar o diretorio de uploads.", ex);
        }
    }

    public StoredFile salvarThumbnail(MultipartFile file) {
        validarImagem(file);

        String extensao = resolverExtensao(file.getContentType(), file.getOriginalFilename());
        String fileName = UUID.randomUUID() + extensao;
        Path destino = thumbnailsDir.resolve(fileName).normalize();

        if (!destino.startsWith(thumbnailsDir)) {
            throw new IllegalArgumentException("Nome de arquivo invalido.");
        }

        try (InputStream inputStream = file.getInputStream()) {
            Files.copy(inputStream, destino, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException ex) {
            throw new IllegalStateException("Nao foi possivel salvar a thumbnail enviada.");
        }

        return new StoredFile(fileName, "/media/thumbnails/" + fileName, file.getContentType(), file.getSize());
    }

    public String getMediaRootUri() {
        return mediaRoot.toUri().toString();
    }

    private void validarImagem(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Selecione uma imagem para enviar.");
        }

        String contentType = file.getContentType();
        if (!StringUtils.hasText(contentType) || !TIPOS_SUPORTADOS.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("Formato invalido. Envie uma imagem JPG, PNG ou WEBP.");
        }
    }

    private String resolverExtensao(String contentType, String originalFilename) {
        if (StringUtils.hasText(contentType)) {
            return switch (contentType.toLowerCase(Locale.ROOT)) {
                case "image/jpeg" -> ".jpg";
                case "image/png" -> ".png";
                case "image/webp" -> ".webp";
                default -> inferirExtensaoDoNome(originalFilename);
            };
        }

        return inferirExtensaoDoNome(originalFilename);
    }

    private String inferirExtensaoDoNome(String originalFilename) {
        if (StringUtils.hasText(originalFilename) && originalFilename.contains(".")) {
            String extensao = originalFilename.substring(originalFilename.lastIndexOf('.')).toLowerCase(Locale.ROOT);
            if (Set.of(".jpg", ".jpeg", ".png", ".webp").contains(extensao)) {
                return ".jpeg".equals(extensao) ? ".jpg" : extensao;
            }
        }
        throw new IllegalArgumentException("Nao foi possivel identificar a extensao da imagem enviada.");
    }

    public record StoredFile(String fileName, String url, String contentType, long size) {
    }
}
