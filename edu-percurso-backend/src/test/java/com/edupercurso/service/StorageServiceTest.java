package com.edupercurso.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StorageServiceTest {

    @TempDir
    Path storagePath;

    @Test
    void salvarThumbnailAceitaPngComAssinaturaValida() {
        StorageService storageService = criarStorageService(1024, 1024);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "thumb.png",
                "image/png",
                new byte[] {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00}
        );

        StorageService.StoredFile storedFile = storageService.salvarThumbnail(file);

        assertThat(storedFile.url()).startsWith("/media/thumbnails/");
        assertThat(Files.exists(storagePath.resolve("thumbnails").resolve(storedFile.fileName()))).isTrue();
    }

    @Test
    void salvarThumbnailRejeitaMimeDeImagemComConteudoInvalido() {
        StorageService storageService = criarStorageService(1024, 1024);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "fake.png",
                "image/png",
                "<script>alert('x')</script>".getBytes(StandardCharsets.UTF_8)
        );

        assertThatThrownBy(() -> storageService.salvarThumbnail(file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("conteudo do arquivo");
    }

    @Test
    void salvarAudioRejeitaArquivoAcimaDoLimiteConfigurado() {
        StorageService storageService = criarStorageService(1024, 4);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "audio.mp3",
                "audio/mpeg",
                new byte[] {'I', 'D', '3', 0x00, 0x01}
        );

        assertThatThrownBy(() -> storageService.salvarAudio(file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Arquivo de audio muito grande");
    }

    private StorageService criarStorageService(long maxImageSizeBytes, long maxAudioSizeBytes) {
        StorageService storageService = new StorageService(
                storagePath.toString(),
                maxImageSizeBytes,
                maxAudioSizeBytes
        );
        storageService.inicializar();
        return storageService;
    }
}
