package fr.lesroutesoubliees.routesoubliees.quest;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import fr.lesroutesoubliees.routesoubliees.audit.AuditService;
import fr.lesroutesoubliees.routesoubliees.shared.config.SiteProperties;

/**
 * Documents d'organisation des quetes.
 *
 * <p>Ces fichiers ne sont pas des medias. Ils ne sont jamais references par un contenu, jamais
 * servis sous {@code /media/**} — qui n'exige que {@code ROLE_USER} — et n'ont donc ni texte
 * alternatif ni condition de publication. Leur seule porte est {@code /api/admin/**}.
 */
@Service
class AdminQuestDocumentService {

	private static final String PDF_MIME_TYPE = "application/pdf";

	/** Signature d'un PDF, exigee a l'offset zero : {@code %PDF-}. */
	private static final byte[] PDF_SIGNATURE = { 0x25, 0x50, 0x44, 0x46, 0x2D };

	/** Sous-repertoire du volume de medias, prevu de longue date par l'architecture. */
	private static final String STORAGE_DIRECTORY = "quests";

	private static final int MAX_LABEL_LENGTH = 160;

	private final QuestRepository quests;
	private final QuestDocumentRepository documents;
	private final AuditService audit;
	private final Path storageRoot;
	private final long maxUploadBytes;

	AdminQuestDocumentService(
		QuestRepository quests,
		QuestDocumentRepository documents,
		AuditService audit,
		SiteProperties properties
	) {
		this.quests = quests;
		this.documents = documents;
		this.audit = audit;
		this.storageRoot = Path.of(properties.mediaStoragePath()).toAbsolutePath().normalize();
		this.maxUploadBytes = properties.questDocumentMaxUploadBytes();
	}

	@Transactional(readOnly = true)
	List<AdminQuestDocumentResponse> listDocuments(String questCode) {
		var quest = findQuest(questCode);
		return documents.findAllByQuestIdOrderByCreatedAtDesc(quest.id())
			.stream()
			.map((document) -> AdminQuestDocumentResponse.from(quest.code(), document))
			.toList();
	}

	@Transactional
	AdminQuestDocumentResponse upload(String questCode, MultipartFile file, String label, String actorEmail) {
		var quest = findQuest(questCode);
		var normalizedLabel = normalizeLabel(label);
		validateUpload(file);

		var id = UUID.randomUUID();
		var storedFilename = id + ".pdf";
		var relativePath = STORAGE_DIRECTORY + "/" + storedFilename;
		var target = resolveStoragePath(relativePath);
		var writtenBytes = writeFile(file, target);

		var document = documents.save(new QuestDocument(
			id,
			quest.id(),
			normalizedLabel,
			normalizeOriginalFilename(file.getOriginalFilename()),
			storedFilename,
			relativePath,
			PDF_MIME_TYPE,
			writtenBytes,
			actorEmail));
		audit.record(actorEmail, "QUEST_DOCUMENT_UPLOADED", "QUEST_DOCUMENT", id.toString(),
			"Document d'organisation ajouté");
		return AdminQuestDocumentResponse.from(quest.code(), document);
	}

	@Transactional(readOnly = true)
	StoredQuestDocument content(String questCode, UUID id) {
		var quest = findQuest(questCode);
		var document = findDocument(quest, id);
		var path = resolveStoragePath(document.relativePath());
		if (!Files.isRegularFile(path)) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Document introuvable.");
		}
		return new StoredQuestDocument(document, new FileSystemResource(path));
	}

	@Transactional
	void delete(String questCode, UUID id, String actorEmail) {
		var quest = findQuest(questCode);
		var document = findDocument(quest, id);
		var path = resolveStoragePath(document.relativePath());
		documents.delete(document);
		deleteFileAfterCommit(path);
		audit.record(actorEmail, "QUEST_DOCUMENT_DELETED", "QUEST_DOCUMENT", id.toString(),
			"Document d'organisation supprimé");
	}

	/**
	 * Resout le code de quete.
	 *
	 * <p>{@code AdminQuestService} fait de meme mais garde sa methode privee : c'est le
	 * repository, partage au sein du package, qui evite la duplication. Le message reste le
	 * sien, pour qu'une quete inconnue reponde la meme chose partout.
	 */
	private Quest findQuest(String code) {
		return quests.findByCode(code)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Quete introuvable."));
	}

	private QuestDocument findDocument(Quest quest, UUID id) {
		return documents.findByIdAndQuestId(id, quest.id())
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Document introuvable."));
	}

	/**
	 * Valide le libelle ici plutot que par {@code @NotBlank}.
	 *
	 * <p>La validation par annotation sur un controleur porte {@code @Validated} passe par un
	 * proxy et leve une {@code ConstraintViolationException}, qu'aucun gestionnaire de Spring MVC
	 * ne traduit : la reponse sortirait en 500 la ou un 400 est attendu.
	 */
	private String normalizeLabel(String label) {
		if (!StringUtils.hasText(label)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le libellé du document est obligatoire.");
		}
		var normalized = label.trim();
		if (normalized.length() > MAX_LABEL_LENGTH) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le libellé du document est trop long.");
		}
		return normalized;
	}

	private void validateUpload(MultipartFile file) {
		if (file == null || file.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le fichier est obligatoire.");
		}
		if (file.getSize() > maxUploadBytes) {
			throw new ResponseStatusException(HttpStatusCode.valueOf(413), "Le fichier depasse la taille autorisee.");
		}
		var mimeType = file.getContentType();
		if (!StringUtils.hasText(mimeType) || !PDF_MIME_TYPE.equals(mimeType.toLowerCase(Locale.ROOT))) {
			throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
				"Seuls les fichiers PDF sont acceptés.");
		}
		validateSignature(file);
	}

	/**
	 * Exige {@code %PDF-} a l'offset zero.
	 *
	 * <p>Le type annonce par le navigateur ne prouve rien : un PNG renomme le porterait aussi.
	 * Seul le debut du fichier est lu — la fin ne l'est pas, un PDF linearise ou mis a jour de
	 * facon incrementale deplacant son {@code %%EOF}.
	 */
	private void validateSignature(MultipartFile file) {
		byte[] head;
		try (var input = file.getInputStream()) {
			head = input.readNBytes(PDF_SIGNATURE.length);
		}
		catch (IOException exception) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le fichier ne peut pas être lu.", exception);
		}
		if (head.length < PDF_SIGNATURE.length) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Signature PDF invalide.");
		}
		for (var index = 0; index < PDF_SIGNATURE.length; index++) {
			if (head[index] != PDF_SIGNATURE[index]) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Signature PDF invalide.");
			}
		}
	}

	/**
	 * Ecrit le fichier et rend sa taille reelle.
	 *
	 * <p>Le corps n'est jamais charge en memoire : le seuil de bascule sur disque du conteneur
	 * vaut zero, et {@link Files#copy} recopie par flux. Charger neuf mebioctets par televersement
	 * concurrent n'aurait servi qu'a mesurer une taille que le systeme de fichiers connait.
	 *
	 * <p>Sans {@code REPLACE_EXISTING}, une collision de nom leve plutot que d'ecraser. Le nom
	 * derive d'un UUID neuf, donc le cas releve du defaut, pas de l'usage.
	 */
	private long writeFile(MultipartFile file, Path target) {
		try {
			Files.createDirectories(target.getParent());
			try (var input = file.getInputStream()) {
				Files.copy(input, target);
			}
			deleteFileOnRollback(target);
			var writtenBytes = Files.size(target);
			if (writtenBytes <= 0) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le fichier est vide.");
			}
			if (writtenBytes > maxUploadBytes) {
				throw new ResponseStatusException(HttpStatusCode.valueOf(413),
					"Le fichier depasse la taille autorisee.");
			}
			return writtenBytes;
		}
		// Une collision de nom leve une FileAlreadyExistsException, sous-classe d'IOException :
		// le nom derivant d'un UUID neuf, ce cas releve du defaut et n'appelle pas sa propre
		// reponse.
		catch (IOException exception) {
			throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
				"Le document ne peut pas être stocké.", exception);
		}
	}

	/**
	 * Efface le fichier neuf si la transaction n'aboutit pas.
	 *
	 * <p>Un orphelin resterait inoffensif — il n'est ni liste ni servi, la diffusion exigeant la
	 * ligne — mais il occuperait le volume sans que rien ne le signale.
	 */
	private void deleteFileOnRollback(Path path) {
		registerSynchronization(new TransactionSynchronization() {

			@Override
			public void afterCompletion(int status) {
				if (status == STATUS_ROLLED_BACK) {
					deleteQuietly(path);
				}
			}
		});
	}

	/**
	 * Efface le fichier une fois la suppression de la ligne acquise.
	 *
	 * <p>Effacer dans la transaction perdrait le fichier sur une annulation ulterieure, la ligne,
	 * elle, revenant : le document deviendrait une entree pointant vers le vide.
	 */
	private void deleteFileAfterCommit(Path path) {
		registerSynchronization(new TransactionSynchronization() {

			@Override
			public void afterCommit() {
				deleteQuietly(path);
			}
		});
	}

	private void registerSynchronization(TransactionSynchronization synchronization) {
		if (TransactionSynchronizationManager.isSynchronizationActive()) {
			TransactionSynchronizationManager.registerSynchronization(synchronization);
		}
	}

	/** Meme garde que pour les medias : un chemin resolu ne doit jamais quitter la racine. */
	private Path resolveStoragePath(String relativePath) {
		var path = storageRoot.resolve(relativePath).normalize();
		if (!path.startsWith(storageRoot)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chemin de document invalide.");
		}
		return path;
	}

	private String normalizeOriginalFilename(String originalFilename) {
		if (!StringUtils.hasText(originalFilename)) {
			return "document.pdf";
		}
		var sanitized = originalFilename.replace('\\', '/');
		sanitized = sanitized.substring(sanitized.lastIndexOf('/') + 1).trim();
		return sanitized.isBlank() ? "document.pdf" : sanitized.substring(0, Math.min(sanitized.length(), 255));
	}

	private void deleteQuietly(Path path) {
		try {
			Files.deleteIfExists(path);
		}
		catch (IOException ignored) {
		}
	}
}
