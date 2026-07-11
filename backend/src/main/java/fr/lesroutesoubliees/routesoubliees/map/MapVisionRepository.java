package fr.lesroutesoubliees.routesoubliees.map;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import fr.lesroutesoubliees.routesoubliees.shared.EditorialStatus;

interface MapVisionRepository extends JpaRepository<MapVision, UUID> {

	Optional<MapVision> findFirstByActiveTrueAndStatus(EditorialStatus status);
}
