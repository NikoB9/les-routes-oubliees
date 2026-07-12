package fr.lesroutesoubliees.routesoubliees.media;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface MediaAssetRepository extends JpaRepository<MediaAsset, UUID> {

	List<MediaAsset> findAllByOrderByCreatedAtDesc();
}
