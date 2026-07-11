package fr.lesroutesoubliees.routesoubliees.home;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import fr.lesroutesoubliees.routesoubliees.shared.EditorialStatus;

interface HomeMessageRepository extends JpaRepository<HomeMessage, UUID> {

	Optional<HomeMessage> findFirstByActiveTrueAndStatus(EditorialStatus status);
}
