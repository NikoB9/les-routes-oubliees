package fr.lesroutesoubliees.routesoubliees.auth;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

interface AdminAllowedEmailRepository extends JpaRepository<AdminAllowedEmail, UUID> {

	boolean existsByActiveTrue();

	boolean existsByEmail(String email);

	long countByActiveTrue();

	List<AdminAllowedEmail> findAllByOrderByCreatedAtDesc();

	Optional<AdminAllowedEmail> findByEmail(String email);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select email from AdminAllowedEmail email")
	List<AdminAllowedEmail> lockAll();
}
