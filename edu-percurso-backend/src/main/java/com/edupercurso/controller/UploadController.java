package com.edupercurso.controller;

import com.edupercurso.service.StorageService;
import com.edupercurso.service.BunnyStreamService;
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
    private final BunnyStreamService bunnyStreamService;

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

    @PostMapping(value = "/videos/bunny", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BunnyVideoUploadResponse> uploadVideoToBunny(
            @RequestPart("file") MultipartFile file,
            @RequestPart(value = "title", required = false) String title
    ) {
        BunnyStreamService.UploadedBunnyVideo uploadedVideo = bunnyStreamService.uploadVideo(file, title);
        return ResponseEntity.ok(new BunnyVideoUploadResponse(
                uploadedVideo.videoId(),
                uploadedVideo.embedUrl(),
                uploadedVideo.title(),
                "BUNNY"
        ));
    }

    public record UploadResponse(String url, String fileName, String contentType, long size) {
    }

    public record BunnyVideoUploadResponse(String videoId, String embedUrl, String title, String provider) {
    }
}
