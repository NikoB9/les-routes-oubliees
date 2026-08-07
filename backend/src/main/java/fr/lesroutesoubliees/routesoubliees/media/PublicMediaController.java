package fr.lesroutesoubliees.routesoubliees.media;

import java.time.Duration;
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

	/**
	 * Duree de conservation d'un media par le client.
	 *
	 * <p>Une URL de media designe toujours le meme octet : {@code MediaService.upload}
	 * derive le nom stocke d'un UUID neuf, et aucun chemin n'est jamais reecrit. Le contenu
	 * peut donc etre garde longtemps sans revalidation.
	 *
	 * <p>{@code private} et non {@code public} : {@code /media/**} exige {@code ROLE_USER},
	 * aucun cache partage ne doit conserver une reponse servie a une identite authentifiee.
	 */
	private static final Duration MEDIA_MAX_AGE = Duration.ofDays(365);

	private final MediaService media;

	PublicMediaController(MediaService media) {
		this.media = media;
	}

	/**
	 * Sert un media public.
	 *
	 * <p>L'en-tete de cache est indispensable au mode hors ligne : le service worker Angular
	 * refuse de conserver une reponse marquee {@code no-store}, et sans conservation la
	 * carte revelee, les avatars et l'embleme disparaissent des que le reseau tombe. Le
	 * reverse proxy ne doit donc jamais reposer son propre {@code Cache-Control} sur ce
	 * chemin : {@code add_header} ajoute sans remplacer, et le client recevrait deux
	 * directives contradictoires.
	 */
	@GetMapping("/{id}")
	ResponseEntity<Resource> getMedia(@PathVariable UUID id) {
		var stored = media.publicMedia(id);
		var filename = stored.asset().storedFilename();
		return ResponseEntity.ok()
			.contentType(MediaType.parseMediaType(stored.asset().mimeType()))
			.header("X-Content-Type-Options", "nosniff")
			.header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().filename(filename).build().toString())
			.cacheControl(CacheControl.maxAge(MEDIA_MAX_AGE).cachePrivate().immutable())
			.body(stored.resource());
	}
}
