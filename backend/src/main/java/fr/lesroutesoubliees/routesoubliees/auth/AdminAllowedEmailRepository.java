package fr.lesroutesoubliees.routesoubliees.auth;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface AdminAllowedEmailRepository extends JpaRepository<AdminAllowedEmail, UUID> {

	boolean existsByActiveTrue();

	Optional<AdminAllowedEmail> findByEmail(String email);
}
