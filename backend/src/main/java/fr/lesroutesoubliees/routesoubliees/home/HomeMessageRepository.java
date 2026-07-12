package fr.lesroutesoubliees.routesoubliees.home;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import fr.lesroutesoubliees.routesoubliees.shared.EditorialStatus;

interface HomeMessageRepository extends JpaRepository<HomeMessage, UUID> {

	Optional<HomeMessage> findFirstByActiveTrueAndStatus(EditorialStatus status);

	@Query("select message from HomeMessage message order by message.updatedAt desc")
	java.util.List<HomeMessage> findAllByUpdatedAtDesc();

	java.util.List<HomeMessage> findByActiveTrue();
}
