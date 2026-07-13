package fr.lesroutesoubliees.routesoubliees.settings;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface SiteSettingsRepository extends JpaRepository<SiteSettings, UUID> {

	Optional<SiteSettings> findFirstByOrderByUpdatedAtDesc();
}
