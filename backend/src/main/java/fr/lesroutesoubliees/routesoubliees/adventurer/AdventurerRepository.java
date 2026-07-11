package fr.lesroutesoubliees.routesoubliees.adventurer;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface AdventurerRepository extends JpaRepository<Adventurer, UUID> {

	List<Adventurer> findByVisibleTrueOrderByDisplayOrderAsc();
}
