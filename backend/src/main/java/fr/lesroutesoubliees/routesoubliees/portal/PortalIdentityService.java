package fr.lesroutesoubliees.routesoubliees.portal;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import fr.lesroutesoubliees.routesoubliees.audit.AuditService;
import fr.lesroutesoubliees.routesoubliees.shared.security.CloudflareAccessPrincipal;

@Service
public class PortalIdentityService {

	/**
	 * Journal des attributions.
	 *
	 * <p>Seuls l'identifiant technique et le mode d'acces sont journalises : l'adresse
	 * Cloudflare Access n'a pas a figurer dans les journaux.
	 */
	private static final Logger LOGGER = LoggerFactory.getLogger(PortalIdentityService.class);

	private final JdbcTemplate jdbc;
	private final AuditService audit;

	PortalIdentityService(JdbcTemplate jdbc, AuditService audit) {
		this.jdbc = jdbc;
		this.audit = audit;
	}

	@Transactional
	PortalMeResponse me(CloudflareAccessPrincipal principal) {
		var identity = ensureIdentity(principal);
		return new PortalMeResponse(toPublicIdentity(identity), availableAdventurers(), guestAvailable(), false);
	}

	@Transactional
	PortalMeResponse assignAdventurer(CloudflareAccessPrincipal principal, UUID adventurerId) {
		var identity = ensureIdentity(principal);
		if (identity.accessMode() != PortalAccessMode.UNASSIGNED) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Le personnage est deja attribue.");
		}
		if (!adventurerIsVisible(adventurerId)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cet aventurier n'est pas disponible.");
		}
		try {
			jdbc.update("""
				update portal_identities
				set adventurer_id = ?, access_mode = 'ADVENTURER', selected_at = ?, updated_at = ?
				where id = ? and access_mode = 'UNASSIGNED'
				""", adventurerId, now(), now(), identity.id());
		}
		catch (DataIntegrityViolationException exception) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Cet aventurier vient d'etre choisi.", exception);
		}
		LOGGER.info("Identite portail {} attribuee en mode {}.", identity.id(), PortalAccessMode.ADVENTURER);
		return me(principal);
	}

	@Transactional
	PortalMeResponse assignGuest(CloudflareAccessPrincipal principal) {
		var identity = ensureIdentity(principal);
		if (identity.accessMode() != PortalAccessMode.UNASSIGNED) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Le mode d'acces est deja attribue.");
		}
		if (!guestAvailable()) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Un aventurier reste disponible.");
		}
		jdbc.update("""
			update portal_identities
			set adventurer_id = null, access_mode = 'GUEST', selected_at = ?, updated_at = ?
			where id = ? and access_mode = 'UNASSIGNED'
			""", now(), now(), identity.id());
		LOGGER.info("Identite portail {} attribuee en mode {}.", identity.id(), PortalAccessMode.GUEST);
		return me(principal);
	}

	@Transactional(readOnly = true)
	public PortalIdentity requireAssignedIdentity(CloudflareAccessPrincipal principal) {
		var identity = findBySubject(principal.subject())
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Identite portail requise."));
		if (identity.accessMode() == PortalAccessMode.UNASSIGNED) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Selection de personnage requise.");
		}
		return identity;
	}

	/**
	 * Identifiant de l'identite portail d'un principal, si elle existe.
	 *
	 * <p>Tolerante, contrairement a {@link #requireAssignedIdentity} : un administrateur
	 * n'a pas forcement choisi de personnage, et cela ne doit pas empecher une action
	 * d'administration. Le resultat est vide dans ce cas.
	 */
	@Transactional(readOnly = true)
	public Optional<UUID> findIdentityId(CloudflareAccessPrincipal principal) {
		return findBySubject(principal.subject()).map(PortalIdentity::id);
	}

	@Transactional(readOnly = true)
	public PortalIdentityResponse publicIdentity(UUID identityId) {
		var identity = findById(identityId)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Identite introuvable."));
		return toPublicIdentity(identity);
	}

	@Transactional(readOnly = true)
	List<AdminPortalIdentityResponse> listAdminIdentities() {
		return jdbc.query("""
			select identity.id, identity.normalized_email, identity.cloudflare_subject, identity.access_mode,
			       identity.adventurer_id, adventurer.name as adventurer_name,
			       identity.selected_at, identity.created_at, identity.updated_at
			from portal_identities identity
			left join adventurers adventurer on adventurer.id = identity.adventurer_id
			order by identity.created_at desc
			""", this::mapAdminIdentity);
	}

	@Transactional
	AdminPortalIdentityResponse updateAdminAssignment(UUID id, AdminPortalAssignmentRequest request, String actorEmail) {
		findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Identite introuvable."));
		if (request.accessMode() == PortalAccessMode.ADVENTURER) {
			if (request.adventurerId() == null || !adventurerIsVisible(request.adventurerId())) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Aventurier invalide.");
			}
			try {
				jdbc.update("""
					update portal_identities
					set access_mode = 'ADVENTURER', adventurer_id = ?, selected_at = coalesce(selected_at, ?), updated_at = ?
					where id = ?
					""", request.adventurerId(), now(), now(), id);
			}
			catch (DataIntegrityViolationException exception) {
				throw new ResponseStatusException(HttpStatus.CONFLICT, "Cet aventurier est deja attribue.", exception);
			}
		}
		else if (request.accessMode() == PortalAccessMode.GUEST) {
			jdbc.update("""
				update portal_identities
				set access_mode = 'GUEST', adventurer_id = null, selected_at = coalesce(selected_at, ?), updated_at = ?
				where id = ?
				""", now(), now(), id);
		}
		else {
			jdbc.update("""
				update portal_identities
				set access_mode = 'UNASSIGNED', adventurer_id = null, selected_at = null, updated_at = ?
				where id = ?
				""", now(), id);
		}
		audit.record(actorEmail, "PORTAL_IDENTITY_ASSIGNMENT_UPDATED", "PORTAL_IDENTITY", id.toString(),
			"Attribution portail mise a jour");
		return listAdminIdentities().stream()
			.filter(identity -> identity.id().equals(id))
			.findFirst()
			.orElseThrow();
	}

	private PortalIdentity ensureIdentity(CloudflareAccessPrincipal principal) {
		return findBySubject(principal.subject()).orElseGet(() -> createIdentity(principal));
	}

	private PortalIdentity createIdentity(CloudflareAccessPrincipal principal) {
		if (principal.email() == null || principal.email().isBlank()) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Email Cloudflare Access requis.");
		}
		var id = UUID.randomUUID();
		try {
			jdbc.update("""
				insert into portal_identities(
					id, cloudflare_subject, normalized_email, access_mode, created_at, updated_at
				)
				values (?, ?, ?, 'UNASSIGNED', ?, ?)
				""", id, principal.subject(), principal.email(), now(), now());
		}
		catch (DataIntegrityViolationException exception) {
			return findBySubject(principal.subject())
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Identite deja existante.", exception));
		}
		return findById(id).orElseThrow();
	}

	private Optional<PortalIdentity> findBySubject(String subject) {
		var identities = jdbc.query("""
			select id, cloudflare_subject, normalized_email, adventurer_id, access_mode, selected_at, created_at, updated_at
			from portal_identities
			where cloudflare_subject = ?
			""", this::mapIdentity, subject);
		return identities.stream().findFirst();
	}

	private Optional<PortalIdentity> findById(UUID id) {
		var identities = jdbc.query("""
			select id, cloudflare_subject, normalized_email, adventurer_id, access_mode, selected_at, created_at, updated_at
			from portal_identities
			where id = ?
			""", this::mapIdentity, id);
		return identities.stream().findFirst();
	}

	private List<PortalAdventurerChoiceResponse> availableAdventurers() {
		return jdbc.query("""
			select adventurer.id, adventurer.name, adventurer.title, adventurer.avatar_path, adventurer.avatar_alt
			from adventurers adventurer
			left join portal_identities identity on identity.adventurer_id = adventurer.id
			where adventurer.visible = true and identity.id is null
			order by adventurer.display_order asc
			""", (rs, rowNum) -> new PortalAdventurerChoiceResponse(
			rs.getObject("id", UUID.class),
			rs.getString("name"),
			rs.getString("title"),
			rs.getString("avatar_path"),
			rs.getString("avatar_alt")));
	}

	private boolean guestAvailable() {
		var count = jdbc.queryForObject("""
			select count(*)
			from adventurers adventurer
			left join portal_identities identity on identity.adventurer_id = adventurer.id
			where adventurer.visible = true and identity.id is null
			""", Long.class);
		return count == null || count == 0;
	}

	private boolean adventurerIsVisible(UUID adventurerId) {
		var count = jdbc.queryForObject(
			"select count(*) from adventurers where id = ? and visible = true",
			Long.class,
			adventurerId);
		return count != null && count > 0;
	}

	private PortalIdentityResponse toPublicIdentity(PortalIdentity identity) {
		if (identity.accessMode() == PortalAccessMode.ADVENTURER && identity.adventurerId() != null) {
			var adventurers = jdbc.query("""
				select name, avatar_path
				from adventurers
				where id = ?
				""", (rs, rowNum) -> new String[] { rs.getString("name"), rs.getString("avatar_path") }, identity.adventurerId());
			if (!adventurers.isEmpty()) {
				var adventurer = adventurers.getFirst();
				return new PortalIdentityResponse(identity.id(), identity.accessMode(), identity.adventurerId(),
					adventurer[0], adventurer[1], identity.selectedAt());
			}
		}
		if (identity.accessMode() == PortalAccessMode.GUEST) {
			return new PortalIdentityResponse(identity.id(), identity.accessMode(), null, "Ombre de la Compagnie", null,
				identity.selectedAt());
		}
		return new PortalIdentityResponse(identity.id(), identity.accessMode(), null, null, null, identity.selectedAt());
	}

	private PortalIdentity mapIdentity(ResultSet rs, int rowNum) throws SQLException {
		return new PortalIdentity(
			rs.getObject("id", UUID.class),
			rs.getString("cloudflare_subject"),
			rs.getString("normalized_email"),
			rs.getObject("adventurer_id", UUID.class),
			PortalAccessMode.valueOf(rs.getString("access_mode")),
			offset(rs.getTimestamp("selected_at")),
			offset(rs.getTimestamp("created_at")),
			offset(rs.getTimestamp("updated_at")));
	}

	private AdminPortalIdentityResponse mapAdminIdentity(ResultSet rs, int rowNum) throws SQLException {
		return new AdminPortalIdentityResponse(
			rs.getObject("id", UUID.class),
			rs.getString("normalized_email"),
			rs.getString("cloudflare_subject"),
			PortalAccessMode.valueOf(rs.getString("access_mode")),
			rs.getObject("adventurer_id", UUID.class),
			rs.getString("adventurer_name"),
			offset(rs.getTimestamp("selected_at")),
			offset(rs.getTimestamp("created_at")),
			offset(rs.getTimestamp("updated_at")));
	}

	private OffsetDateTime now() {
		return OffsetDateTime.now(ZoneOffset.UTC);
	}

	private OffsetDateTime offset(Timestamp timestamp) {
		return timestamp == null ? null : timestamp.toInstant().atOffset(ZoneOffset.UTC);
	}
}
