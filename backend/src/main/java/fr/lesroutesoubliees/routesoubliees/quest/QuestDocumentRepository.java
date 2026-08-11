package fr.lesroutesoubliees.routesoubliees.quest;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface QuestDocumentRepository extends JpaRepository<QuestDocument, UUID> {

	List<QuestDocument> findAllByQuestIdOrderByCreatedAtDesc(UUID questId);

	/**
	 * Un document n'existe que dans le contexte de sa quete.
	 *
	 * <p>Chercher par identifiant seul ferait servir le document d'une autre quete a une URL qui
	 * en annonce une : le couple est donc toujours exige, et une discordance vaut un 404.
	 */
	Optional<QuestDocument> findByIdAndQuestId(UUID id, UUID questId);
}
