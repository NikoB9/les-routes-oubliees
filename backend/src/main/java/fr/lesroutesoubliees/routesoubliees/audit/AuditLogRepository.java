package fr.lesroutesoubliees.routesoubliees.audit;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

	List<AuditLog> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
