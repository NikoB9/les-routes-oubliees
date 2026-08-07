package fr.lesroutesoubliees.routesoubliees.offline;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.info.BuildProperties;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Version du contenu public, calculee sans reconstruire l'instantane.
 *
 * <p>{@code /api/public/content-version} est interroge a chaque ouverture de l'application,
 * uniquement pour savoir si l'instantane deja stocke est encore valable. Le deriver de la
 * charge utile rendue revenait a payer le prix de l'instantane complet — toutes les quetes
 * visibles et le detail de chacune — pour n'en renvoyer qu'un condense.
 */
@Component
class PublicContentVersionCalculator {

	/**
	 * Tables alimentant l'instantane public.
	 *
	 * <p>Le couple {@code count(*)} et {@code max(updated_at)} couvre l'insertion, la
	 * modification <strong>et</strong> la suppression, qu'un {@code max(updated_at)} seul
	 * manquerait : supprimer une ligne ne rajeunit aucun horodatage.
	 *
	 * <p>Aucun filtre de visibilite n'est applique. Une modification de brouillon invalidera
	 * donc inutilement le cache d'un client, mais la charge utile est petite, alors qu'une
	 * sous-invalidation figerait un contenu perime hors ligne. L'erreur sure est de ce cote.
	 */
	private static final List<String> PUBLIC_CONTENT_TABLES = List.of(
		"site_settings",
		"home_messages",
		"company_profiles",
		"adventurers",
		"map_visions",
		"map_markers",
		"quests");

	/** Signature de repli lorsque {@code build-info.properties} est absent du classpath. */
	private static final String DEVELOPMENT_BUILD = "dev";

	private final JdbcTemplate jdbc;
	private final String buildSignature;

	PublicContentVersionCalculator(JdbcTemplate jdbc, ObjectProvider<BuildProperties> buildProperties) {
		this.jdbc = jdbc;
		var properties = buildProperties.getIfAvailable();
		this.buildSignature = properties == null ? DEVELOPMENT_BUILD : String.valueOf(properties.getTime());
	}

	/**
	 * Volontairement {@code public} sur une classe qui ne l'est pas : Spring ignore
	 * silencieusement {@code @Transactional} sur une methode non publique, et l'annotation
	 * n'aurait alors ete qu'une promesse decorative. La portee reelle reste celle du paquet.
	 */
	@Transactional(readOnly = true)
	public String currentVersion() {
		return hash(buildSignature + '|' + databaseSignature());
	}

	/**
	 * Etat des tables publiques, en une seule requete.
	 *
	 * <p>La requete est assemblee a partir d'une liste de noms de tables constante, jamais
	 * d'une valeur recue : la repetition manuelle de quatorze sous-requetes serait plus
	 * exposee a l'erreur de copie qu'a l'injection.
	 */
	private String databaseSignature() {
		var sql = PUBLIC_CONTENT_TABLES.stream()
			.map((table) -> "(select count(*) from %s), (select max(updated_at) from %s)".formatted(table, table))
			.collect(Collectors.joining(", ", "select ", ""));
		return jdbc.queryForObject(sql, (rs, rowNum) -> {
			var signature = new StringBuilder();
			var columns = rs.getMetaData().getColumnCount();
			for (var column = 1; column <= columns; column++) {
				signature.append(rs.getString(column)).append('|');
			}
			return signature.toString();
		});
	}

	/**
	 * Melange une signature de build a l'etat des tables.
	 *
	 * <p>Le condense ne portant plus sur le rendu, une evolution de {@code MarkdownRenderer}
	 * ou de la forme des DTO ne changerait plus la version : les clients garderaient un
	 * instantane perime jusqu'a la prochaine ecriture en base. La signature de build force la
	 * mise a jour a chaque deploiement.
	 */
	private String hash(String signature) {
		try {
			var digest = MessageDigest.getInstance("SHA-256");
			return toHex(digest.digest(signature.getBytes(StandardCharsets.UTF_8)));
		}
		catch (NoSuchAlgorithmException exception) {
			throw new IllegalStateException("Unable to compute public content version", exception);
		}
	}

	private String toHex(byte[] bytes) {
		var builder = new StringBuilder(bytes.length * 2);
		for (var value : bytes) {
			builder.append(String.format("%02x", value));
		}
		return builder.toString();
	}
}
