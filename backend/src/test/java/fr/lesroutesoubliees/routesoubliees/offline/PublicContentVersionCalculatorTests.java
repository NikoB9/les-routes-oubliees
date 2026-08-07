package fr.lesroutesoubliees.routesoubliees.offline;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import fr.lesroutesoubliees.routesoubliees.TestcontainersConfiguration;

/**
 * La version du contenu public ne portant plus sur la charge utile rendue, seule une
 * verification sur une vraie base garantit qu'elle reagit encore a toutes les formes
 * d'ecriture. Une regression ici est invisible en exploitation : les clients garderaient
 * simplement un instantane perime, sans qu'aucune erreur ne soit levee.
 *
 * <p>{@code @Transactional} pour l'annulation automatique : ces tests ecrivent dans des
 * tables dont le contenu de demonstration est verifie ailleurs.
 */
@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
@SpringBootTest
@Transactional
class PublicContentVersionCalculatorTests {

	@Autowired
	private PublicContentVersionCalculator calculator;

	@Autowired
	private JdbcTemplate jdbc;

	@Test
	void staysStableWithoutAnyWrite() {
		assertThat(calculator.currentVersion()).isEqualTo(calculator.currentVersion());
	}

	@Test
	void changesWhenPublicContentIsInserted() {
		var before = calculator.currentVersion();

		insertDraftMessage(UUID.randomUUID());

		assertThat(calculator.currentVersion()).isNotEqualTo(before);
	}

	@Test
	void changesWhenPublicContentIsUpdated() {
		var id = UUID.randomUUID();
		insertDraftMessage(id);
		var before = calculator.currentVersion();

		jdbc.update("update home_messages set title = ?, updated_at = ? where id = ?",
			"Titre revise", now(), id);

		assertThat(calculator.currentVersion()).isNotEqualTo(before);
	}

	/**
	 * Cas qu'un {@code max(updated_at)} seul manquerait : supprimer une ligne ne rajeunit
	 * aucun horodatage, c'est le {@code count(*)} qui l'attrape.
	 */
	@Test
	void changesWhenPublicContentIsDeleted() {
		var id = UUID.randomUUID();
		insertDraftMessage(id);
		var before = calculator.currentVersion();

		jdbc.update("delete from home_messages where id = ?", id);

		assertThat(calculator.currentVersion()).isNotEqualTo(before);
	}

	/** Brouillon inactif : invisible du contenu public, mais compte pour la version. */
	private void insertDraftMessage(UUID id) {
		jdbc.update("""
			insert into home_messages(
				id, title, content_markdown, importance, status, active, countdown_enabled,
				created_at, updated_at
			)
			values (?, ?, ?, 'INFORMATION', 'DRAFT', false, false, ?, ?)
			""", id, "Message de version", "Contenu", now(), now());
	}

	private OffsetDateTime now() {
		return OffsetDateTime.now(ZoneOffset.UTC);
	}
}
