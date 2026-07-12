package fr.lesroutesoubliees.routesoubliees.group;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface CompanyProfileRepository extends JpaRepository<CompanyProfile, UUID> {

	Optional<CompanyProfile> findFirstByActiveTrue();

	java.util.List<CompanyProfile> findByActiveTrue();

	java.util.List<CompanyProfile> findAllByOrderByUpdatedAtDesc();
}
