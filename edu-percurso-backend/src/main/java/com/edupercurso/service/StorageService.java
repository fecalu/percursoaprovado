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

    private static final long DEFAULT_MAX_IMAGE_SIZE_BYTES = 8L * 1024L * 1024L;
    private static final long DEFAULT_MAX_AUDIO_SIZE_BYTES = 20L * 1024L * 1024L;
    private static final int HEADER_BYTES_TO_VALIDATE = 16;

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
    private final long maxImageSizeBytes;
    private final long maxAudioSizeBytes;

    public StorageService(
            @Value("${app.storage.path:storage}") String storagePath,
            @Value("${app.upload.image.max-size-bytes:8388608}") long maxImageSizeBytes,
            @Value("${app.upload.audio.max-size-bytes:20971520}") long maxAudioSizeBytes
    ) {
        this.mediaRoot = Paths.get(storagePath).toAbsolutePath().normalize();
        this.thumbnailsDir = mediaRoot.resolve("thumbnails").normalize();
        this.audiosDir = mediaRoot.resolve("audios").normalize();
        this.maxImageSizeBytes = maxImageSizeBytes > 0 ? maxImageSizeBytes : DEFAULT_MAX_IMAGE_SIZE_BYTES;
        this.maxAudioSizeBytes = maxAudioSizeBytes > 0 ? maxAudioSizeBytes : DEFAULT_MAX_AUDIO_SIZE_BYTES;
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

    public boolean isManagedMediaUrl(String url) {
        return StringUtils.hasText(url) && url.trim().startsWith("/media/");
    }

    public void excluirArquivoPorUrl(String url) {
        if (!isManagedMediaUrl(url)) {
            return;
        }

        Path destino = resolverCaminhoDoArquivo(url.trim());

        try {
            Files.deleteIfExists(destino);
        } catch (IOException ex) {
            throw new IllegalStateException("Nao foi possivel remover o arquivo de midia.", ex);
        }
    }

    private void validarImagem(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Selecione uma imagem para enviar.");
        }

        validarTamanho(file, maxImageSizeBytes, "imagem");

        String contentType = normalizarContentType(file.getContentType());
        if (!StringUtils.hasText(contentType) || !TIPOS_IMAGEM_SUPORTADOS.contains(contentType)) {
            throw new IllegalArgumentException("Formato invalido. Envie uma imagem JPG, PNG ou WEBP.");
        }

        if (!assinaturaImagemValida(file, contentType)) {
            throw new IllegalArgumentException("O conteudo do arquivo nao corresponde a uma imagem JPG, PNG ou WEBP valida.");
        }
    }

    private void validarAudio(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Selecione um audio para enviar.");
        }

        validarTamanho(file, maxAudioSizeBytes, "audio");

        String contentType = normalizarContentType(file.getContentType());
        String extensao = extrairExtensao(file.getOriginalFilename());

        boolean mimeValido = StringUtils.hasText(contentType) && TIPOS_AUDIO_SUPORTADOS.contains(contentType);
        boolean extensaoValida = Set.of(".mp3", ".m4a", ".ogg").contains(extensao);

        if (!mimeValido && !extensaoValida) {
            throw new IllegalArgumentException("Formato invalido. Envie um audio MP3, M4A ou OGG.");
        }

        if (!assinaturaAudioValida(file)) {
            throw new IllegalArgumentException("O conteudo do arquivo nao corresponde a um audio MP3, M4A ou OGG valido.");
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
        String extensaoOriginal = extrairExtensao(originalFilename);
        if (StringUtils.hasText(extensaoOriginal) && Set.of(".mp3", ".m4a", ".ogg").contains(extensaoOriginal)) {
            return extensaoOriginal;
        }

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

    private String normalizarContentType(String contentType) {
        if (!StringUtils.hasText(contentType)) {
            return null;
        }

        String normalized = contentType.toLowerCase(Locale.ROOT).trim();
        int parameterStart = normalized.indexOf(';');
        return parameterStart >= 0 ? normalized.substring(0, parameterStart).trim() : normalized;
    }

    private void validarTamanho(MultipartFile file, long maxSizeBytes, String tipoArquivo) {
        if (file.getSize() > maxSizeBytes) {
            throw new IllegalArgumentException("Arquivo de " + tipoArquivo + " muito grande. Limite: "
                    + formatarTamanho(maxSizeBytes) + ".");
        }
    }

    private String formatarTamanho(long bytes) {
        double megabytes = bytes / 1024D / 1024D;
        if (Math.rint(megabytes) == megabytes) {
            return String.format(Locale.ROOT, "%.0fMB", megabytes);
        }
        return String.format(Locale.ROOT, "%.1fMB", megabytes);
    }

    private boolean assinaturaImagemValida(MultipartFile file, String contentType) {
        byte[] header = lerCabecalho(file);
        return switch (contentType) {
            case "image/jpeg" -> comecaCom(header, 0xFF, 0xD8, 0xFF);
            case "image/png" -> comecaCom(header, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A);
            case "image/webp" -> possuiAssinaturaAscii(header, 0, "RIFF") && possuiAssinaturaAscii(header, 8, "WEBP");
            default -> false;
        };
    }

    private boolean assinaturaAudioValida(MultipartFile file) {
        byte[] header = lerCabecalho(file);
        return possuiAssinaturaAscii(header, 0, "ID3")
                || ehFrameMp3(header)
                || possuiAssinaturaAscii(header, 0, "OggS")
                || possuiAssinaturaAscii(header, 4, "ftyp")
                || ehAacAdts(header);
    }

    private byte[] lerCabecalho(MultipartFile file) {
        try (InputStream inputStream = file.getInputStream()) {
            return inputStream.readNBytes(HEADER_BYTES_TO_VALIDATE);
        } catch (IOException ex) {
            throw new IllegalStateException("Nao foi possivel validar o arquivo enviado.", ex);
        }
    }

    private boolean comecaCom(byte[] header, int... bytes) {
        if (header.length < bytes.length) {
            return false;
        }

        for (int i = 0; i < bytes.length; i++) {
            if ((header[i] & 0xFF) != bytes[i]) {
                return false;
            }
        }

        return true;
    }

    private boolean possuiAssinaturaAscii(byte[] header, int offset, String assinatura) {
        if (header.length < offset + assinatura.length()) {
            return false;
        }

        for (int i = 0; i < assinatura.length(); i++) {
            if ((header[offset + i] & 0xFF) != assinatura.charAt(i)) {
                return false;
            }
        }

        return true;
    }

    private boolean ehFrameMp3(byte[] header) {
        return header.length >= 2
                && (header[0] & 0xFF) == 0xFF
                && ((header[1] & 0xE0) == 0xE0);
    }

    private boolean ehAacAdts(byte[] header) {
        return header.length >= 2
                && (header[0] & 0xFF) == 0xFF
                && ((header[1] & 0xF0) == 0xF0);
    }

    private Path resolverCaminhoDoArquivo(String url) {
        String relativePath = url.substring("/media/".length());
        Path destino = mediaRoot.resolve(relativePath).normalize();

        if (!destino.startsWith(mediaRoot)) {
            throw new IllegalArgumentException("URL de midia invalida.");
        }

        return destino;
    }

    public record StoredFile(String fileName, String url, String contentType, long size) {
    }
}
