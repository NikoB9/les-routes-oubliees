package fr.lesroutesoubliees.routesoubliees.map;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

interface MapMarkerRepository extends JpaRepository<MapMarker, UUID> {

	@Query(
		value = """
			select
			    marker.id as id,
			    marker.title as title,
			    marker.position_x as positionX,
			    marker.position_y as positionY,
			    marker.display_order as displayOrder,
			    quest.code as questCode
			from map_markers marker
			join quests quest on quest.id = marker.quest_id
			where marker.active = true
			  and quest.status = 'PUBLISHED'
			  and quest.visible_to_players = true
			order by marker.display_order asc
			""",
		nativeQuery = true
	)
	List<MapMarkerPublicProjection> findPublicMarkers();
}
