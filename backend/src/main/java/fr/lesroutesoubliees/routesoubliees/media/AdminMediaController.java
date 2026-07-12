package fr.lesroutesoubliees.routesoubliees.media;

import java.security.Principal;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Validated
@RestController
@RequestMapping("/api/admin/media")
class AdminMediaController {

	private final MediaService media;

	AdminMediaController(MediaService media) {
		this.media = media;
	}

	@GetMapping
	List<AdminMediaResponse> listMedia() {
		return media.listMedia();
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	AdminMediaResponse uploadMedia(
		@RequestParam("file") MultipartFile file,
		@RequestParam("altText") @NotBlank @Size(max = 280) String altText,
		Principal principal
	) {
		var createdBy = principal == null ? null : principal.getName();
		return media.upload(file, altText, createdBy);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteMedia(@org.springframework.web.bind.annotation.PathVariable UUID id) {
		media.delete(id);
	}
}
