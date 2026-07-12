package fr.lesroutesoubliees.routesoubliees.adventurer;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

interface AdventurerRepository extends JpaRepository<Adventurer, UUID> {

	List<Adventurer> findByVisibleTrueOrderByDisplayOrderAsc();

	List<Adventurer> findAllByOrderByDisplayOrderAsc();

	@Query("select coalesce(max(adventurer.displayOrder), 0) from Adventurer adventurer")
	int maxDisplayOrder();
}
