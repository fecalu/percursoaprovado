package com.edupercurso.controller;

import com.edupercurso.service.StorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/uploads")
@RequiredArgsConstructor
public class UploadController {

    private final StorageService storageService;

    @PostMapping(value = "/thumbnails", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UploadResponse> uploadThumbnail(@RequestPart("file") MultipartFile file) {
        StorageService.StoredFile storedFile = storageService.salvarThumbnail(file);
        return ResponseEntity.ok(new UploadResponse(
                storedFile.url(),
                storedFile.fileName(),
                storedFile.contentType(),
                storedFile.size()
        ));
    }

    public record UploadResponse(String url, String fileName, String contentType, long size) {
    }
}
