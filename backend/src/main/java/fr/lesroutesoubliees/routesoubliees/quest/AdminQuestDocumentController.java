package fr.lesroutesoubliees.routesoubliees.quest;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import fr.lesroutesoubliees.routesoubliees.auth.AdminIdentity;

/**
 * Documents d'organisation d'une quete.
 *
 * <p>Volontairement sans {@code @Validated} ni contrainte sur les parametres : la validation
 * appartient au service, qui rend des messages propres a ce formulaire. Une contrainte posee ici
 * s'appliquerait avant lui et produirait une reponse moins precise, voire un 500 si elle passait
 * par le proxy de validation.
 *
 * <p>Aucune regle de securite n'est declaree : {@code /api/admin/**} exige deja le role
 * administrateur, l'appartenance a la liste blanche et le jeton CSRF pour les ecritures.
 */
@RestController
@RequestMapping("/api/admin/quest-tabs/{code}/documents")
class AdminQuestDocumentController {

	private final AdminQuestDocumentService documents;
	private final AdminIdentity identity;

	AdminQuestDocumentController(AdminQuestDocumentService documents, AdminIdentity identity) {
		this.documents = documents;
		this.identity = identity;
	}

	@GetMapping
	List<AdminQuestDocumentResponse> listDocuments(@PathVariable String code) {
		return documents.listDocuments(code);
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	AdminQuestDocumentResponse uploadDocument(
		@PathVariable String code,
		@RequestParam("file") MultipartFile file,
		@RequestParam("label") String label,
		Authentication authentication
	) {
		return documents.upload(code, file, label, identity.email(authentication));
	}

	/**
	 * Sert le document a l'organisateur.
	 *
	 * <p>Le type est impose par le serveur et {@code nosniff} interdit au navigateur d'en deviner
	 * un autre : le fichier a beau avoir ete valide a l'entree, rien ne doit pouvoir le faire
	 * interpreter autrement que comme un PDF.
	 *
	 * <p>{@code no-store} plutot que le cache long des medias : ce document decrit l'organisation
	 * d'une partie, il n'a rien a laisser derriere lui sur le poste consulte. Nginx pose la meme
	 * valeur sur {@code /api/}, et {@code add_header} ajoutant sans remplacer, les deux doivent
	 * rester identiques.
	 *
	 * <p>Le nom de fichier voyage en UTF-8. Sans jeu de caracteres, un accent sortirait mal
	 * encode ; sans nettoyage, un retour a la ligne dans le nom d'origine permettrait d'injecter
	 * un en-tete.
	 */
	@GetMapping("/{id}/content")
	ResponseEntity<Resource> getDocumentContent(@PathVariable String code, @PathVariable UUID id) {
		var stored = documents.content(code, id);
		var filename = headerSafeFilename(stored.document().originalFilename());
		return ResponseEntity.ok()
			.contentType(MediaType.APPLICATION_PDF)
			.header("X-Content-Type-Options", "nosniff")
			.header(HttpHeaders.CONTENT_DISPOSITION,
				ContentDisposition.inline().filename(filename, StandardCharsets.UTF_8).build().toString())
			.header(HttpHeaders.CACHE_CONTROL, "no-store")
			.body(stored.resource());
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteDocument(@PathVariable String code, @PathVariable UUID id, Authentication authentication) {
		documents.delete(code, id, identity.email(authentication));
	}

	private String headerSafeFilename(String filename) {
		var sanitized = filename.replaceAll("[\\r\\n\"]", "").trim();
		return sanitized.isBlank() ? "document.pdf" : sanitized;
	}
}
