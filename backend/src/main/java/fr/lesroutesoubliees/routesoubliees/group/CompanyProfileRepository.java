package fr.lesroutesoubliees.routesoubliees.group;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface CompanyProfileRepository extends JpaRepository<CompanyProfile, UUID> {

	Optional<CompanyProfile> findFirstByActiveTrue();
}
