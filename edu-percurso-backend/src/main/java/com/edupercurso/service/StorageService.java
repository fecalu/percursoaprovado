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

    private static final Set<String> TIPOS_IMAGEM_SUPORTADOS = Set.of(
            "image/jpeg",
            "image/png",
            "image/webp"
    );
    private static final Set<String> TIPOS_AUDIO_SUPORTADOS = Set.of(
            "audio/mpeg",
            "audio/mp3",
            "audio/mp4",
            "audio/x-m4a",
            "audio/aac",
            "audio/ogg",
            "application/ogg"
    );

    private final Path mediaRoot;
    private final Path thumbnailsDir;
    private final Path audiosDir;

    public StorageService(@Value("${app.storage.path:storage}") String storagePath) {
        this.mediaRoot = Paths.get(storagePath).toAbsolutePath().normalize();
        this.thumbnailsDir = mediaRoot.resolve("thumbnails").normalize();
        this.audiosDir = mediaRoot.resolve("audios").normalize();
    }

    @PostConstruct
    public void inicializar() {
        try {
            Files.createDirectories(thumbnailsDir);
            Files.createDirectories(audiosDir);
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

    public StoredFile salvarAudio(MultipartFile file) {
        validarAudio(file);

        String extensao = resolverExtensaoAudio(file.getContentType(), file.getOriginalFilename());
        String fileName = UUID.randomUUID() + extensao;
        Path destino = audiosDir.resolve(fileName).normalize();

        if (!destino.startsWith(audiosDir)) {
            throw new IllegalArgumentException("Nome de arquivo invalido.");
        }

        try (InputStream inputStream = file.getInputStream()) {
            Files.copy(inputStream, destino, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException ex) {
            throw new IllegalStateException("Nao foi possivel salvar o audio enviado.");
        }

        return new StoredFile(fileName, "/media/audios/" + fileName, file.getContentType(), file.getSize());
    }

    public String getMediaRootUri() {
        return mediaRoot.toUri().toString();
    }

    private void validarImagem(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Selecione uma imagem para enviar.");
        }

        String contentType = file.getContentType();
        if (!StringUtils.hasText(contentType) || !TIPOS_IMAGEM_SUPORTADOS.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("Formato invalido. Envie uma imagem JPG, PNG ou WEBP.");
        }
    }

    private void validarAudio(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Selecione um audio para enviar.");
        }

        String contentType = StringUtils.hasText(file.getContentType())
                ? file.getContentType().toLowerCase(Locale.ROOT)
                : null;
        String extensao = extrairExtensao(file.getOriginalFilename());

        boolean mimeValido = StringUtils.hasText(contentType) && TIPOS_AUDIO_SUPORTADOS.contains(contentType);
        boolean extensaoValida = Set.of(".mp3", ".m4a", ".ogg").contains(extensao);

        if (!mimeValido && !extensaoValida) {
            throw new IllegalArgumentException("Formato invalido. Envie um audio MP3, M4A ou OGG.");
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
        String extensao = extrairExtensao(originalFilename);
        if (StringUtils.hasText(extensao) && Set.of(".jpg", ".jpeg", ".png", ".webp").contains(extensao)) {
            return ".jpeg".equals(extensao) ? ".jpg" : extensao;
        }
        throw new IllegalArgumentException("Nao foi possivel identificar a extensao da imagem enviada.");
    }

    private String resolverExtensaoAudio(String contentType, String originalFilename) {
        if (StringUtils.hasText(contentType)) {
            return switch (contentType.toLowerCase(Locale.ROOT)) {
                case "audio/mpeg", "audio/mp3" -> ".mp3";
                case "audio/mp4", "audio/x-m4a", "audio/aac" -> ".m4a";
                case "audio/ogg", "application/ogg" -> ".ogg";
                default -> inferirExtensaoAudioDoNome(originalFilename);
            };
        }

        return inferirExtensaoAudioDoNome(originalFilename);
    }

    private String inferirExtensaoAudioDoNome(String originalFilename) {
        String extensao = extrairExtensao(originalFilename);
        if (StringUtils.hasText(extensao) && Set.of(".mp3", ".m4a", ".ogg").contains(extensao)) {
            return extensao;
        }
        throw new IllegalArgumentException("Nao foi possivel identificar a extensao do audio enviado.");
    }

    private String extrairExtensao(String originalFilename) {
        if (StringUtils.hasText(originalFilename) && originalFilename.contains(".")) {
            return originalFilename.substring(originalFilename.lastIndexOf('.')).toLowerCase(Locale.ROOT);
        }
        return null;
    }

    public record StoredFile(String fileName, String url, String contentType, long size) {
    }
}
