package fr.lesroutesoubliees.routesoubliees.media;

import java.util.UUID;

import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/media")
class PublicMediaController {

	private final MediaService media;

	PublicMediaController(MediaService media) {
		this.media = media;
	}

	@GetMapping("/{id}")
	ResponseEntity<Resource> getMedia(@PathVariable UUID id) {
		var stored = media.publicMedia(id);
		var filename = stored.asset().storedFilename();
		return ResponseEntity.ok()
			.contentType(MediaType.parseMediaType(stored.asset().mimeType()))
			.header("X-Content-Type-Options", "nosniff")
			.header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().filename(filename).build().toString())
			.cacheControl(CacheControl.noCache())
			.body(stored.resource());
	}
}
