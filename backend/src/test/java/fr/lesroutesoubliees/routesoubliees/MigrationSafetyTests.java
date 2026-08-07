package fr.lesroutesoubliees.routesoubliees;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

class MigrationSafetyTests {

	private static final int FIRST_GUARDED_MIGRATION_VERSION = 10;
	private static final String REQUIRED_MARKER = "LRO_ALLOW_EDITORIAL_DATA_REWRITE";
	private static final Pattern MIGRATION_VERSION = Pattern.compile("^V(\\d+)__.*\\.sql$");

	private static final String EDITORIAL_TABLES =
		"home_messages|company_profiles|adventurers|quests|map_visions|map_markers|site_settings";

	/**
	 * Nom de table editoriale, prefixe de schema compris.
	 *
	 * <p>Sans ce prefixe optionnel, un simple {@code update public.quests} suffisait a
	 * traverser le garde-fou sans que personne n'ait eu l'intention de le contourner.
	 */
	private static final String QUALIFIED_EDITORIAL_TABLE = "(?:\\w+\\.)?(?:" + EDITORIAL_TABLES + ")";

	/**
	 * Formes destructrices surveillees.
	 *
	 * <p>Deux motifs, parce que la table ne se trouve pas au meme endroit. Le premier couvre
	 * les verbes qui la nomment immediatement. Le second couvre {@code alter table ... drop},
	 * ou la destruction est annoncee plus loin : {@code [^;]*} borne la recherche a la meme
	 * instruction, sans quoi un {@code drop} appartenant a l'instruction suivante lui serait
	 * attribue.
	 *
	 * <p>Un {@code alter ... alter column ... drop not null} sera signale alors qu'il ne detruit
	 * aucune donnee. C'est voulu : un filet de securite doit pecher par exces, et le marqueur
	 * reste disponible pour l'auteur qui a examine son cas.
	 */
	private static final List<Pattern> DESTRUCTIVE_EDITORIAL_STATEMENTS = List.of(
		Pattern.compile(
			"\\b(?:update|delete\\s+from|truncate\\s+table|drop\\s+table|merge\\s+into)\\s+"
				+ "(?:if\\s+exists\\s+)?" + QUALIFIED_EDITORIAL_TABLE + "\\b",
			Pattern.CASE_INSENSITIVE),
		Pattern.compile(
			"\\balter\\s+table\\s+(?:if\\s+exists\\s+)?" + QUALIFIED_EDITORIAL_TABLE + "\\b[^;]*\\bdrop\\b",
			Pattern.CASE_INSENSITIVE));

	@Test
	void futureMigrationsMustNotRewriteEditorialTablesSilently() throws IOException {
		Path migrations = Path.of("src/main/resources/db/migration");

		List<String> unsafeMigrations;
		try (var files = Files.list(migrations)) {
			unsafeMigrations = files
				.filter(Files::isRegularFile)
				.filter(MigrationSafetyTests::isGuardedMigration)
				.filter(MigrationSafetyTests::rewritesEditorialDataWithoutMarker)
				.map(path -> path.getFileName().toString())
				.sorted()
				.toList();
		}

		assertThat(unsafeMigrations)
			.as("Future migrations must not UPDATE/DELETE/TRUNCATE editorial tables without %s.", REQUIRED_MARKER)
			.isEmpty();
	}

	/**
	 * Le garde-fou lui-meme, verifie sur des instructions temoins.
	 *
	 * <p>Il ne s'appliquait qu'aux fichiers presents : rien ne demontrait qu'il detecte ce
	 * qu'il pretend detecter. Quatre formes sur huit lui echappaient, dont
	 * {@code alter table ... drop column} — l'accident classique d'evolution de schema — et la
	 * qualification par schema, qui suffisait a le contourner sans meme y penser. Une CI au
	 * vert valait alors approbation.
	 */
	@Test
	void blocksEveryDestructiveFormOnEditorialTables() {
		List<String> destructive = List.of(
			"update quests set title = 'x';",
			"delete from quests where id = 1;",
			"truncate table adventurers;",
			"alter table quests drop column extra_content_markdown;",
			"drop table quests;",
			"drop table if exists map_visions;",
			"update public.quests set title = 'x';",
			"merge into quests using source on true when matched then update set title = 'x';");

		assertThat(destructive).allSatisfy(sql ->
			assertThat(isDestructive(sql)).as("%s doit exiger le marqueur %s.", sql, REQUIRED_MARKER).isTrue());
	}

	/**
	 * Une migration purement additive ne doit pas reclamer le marqueur : un filet qui se
	 * declenche sans raison finit par etre desarme.
	 */
	@Test
	void leavesAdditiveMigrationsAlone() {
		List<String> additive = List.of(
			"alter table quests add column note text;",
			"create table quests_archive (id uuid primary key);",
			"create index idx_quests_note on quests (note);",
			"alter table map_markers add constraint ck_x check (label_offset_px >= 0);");

		assertThat(additive).allSatisfy(sql ->
			assertThat(isDestructive(sql)).as("%s ne doit pas reclamer le marqueur.", sql).isFalse());
	}

	private static boolean isGuardedMigration(Path path) {
		Matcher matcher = MIGRATION_VERSION.matcher(path.getFileName().toString());
		return matcher.matches() && Integer.parseInt(matcher.group(1)) >= FIRST_GUARDED_MIGRATION_VERSION;
	}

	private static boolean rewritesEditorialDataWithoutMarker(Path path) {
		try {
			String sql = Files.readString(path, StandardCharsets.UTF_8);
			return !sql.contains(REQUIRED_MARKER) && isDestructive(sql);
		} catch (IOException exception) {
			throw new IllegalStateException("Unable to read migration " + path, exception);
		}
	}

	private static boolean isDestructive(String sql) {
		String normalizedSql = sql.toLowerCase(Locale.ROOT);
		return DESTRUCTIVE_EDITORIAL_STATEMENTS.stream()
			.anyMatch(pattern -> pattern.matcher(normalizedSql).find());
	}
}
