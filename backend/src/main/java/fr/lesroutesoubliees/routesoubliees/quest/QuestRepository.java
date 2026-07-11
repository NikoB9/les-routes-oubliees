package fr.lesroutesoubliees.routesoubliees.quest;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import fr.lesroutesoubliees.routesoubliees.shared.EditorialStatus;

interface QuestRepository extends JpaRepository<Quest, UUID> {

	List<Quest> findByStatusAndVisibleToPlayersTrueOrderByDisplayOrderAsc(EditorialStatus status);

	Optional<Quest> findByCodeAndStatusAndVisibleToPlayersTrue(String code, EditorialStatus status);
}
