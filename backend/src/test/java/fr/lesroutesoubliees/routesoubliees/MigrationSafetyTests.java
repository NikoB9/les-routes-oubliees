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
	private static final Pattern DESTRUCTIVE_EDITORIAL_STATEMENT = Pattern.compile(
		"\\b(update|delete\\s+from|truncate\\s+table)\\s+(" +
		"home_messages|company_profiles|adventurers|quests|map_visions|map_markers|site_settings" +
		")\\b",
		Pattern.CASE_INSENSITIVE
	);

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

	private static boolean isGuardedMigration(Path path) {
		Matcher matcher = MIGRATION_VERSION.matcher(path.getFileName().toString());
		return matcher.matches() && Integer.parseInt(matcher.group(1)) >= FIRST_GUARDED_MIGRATION_VERSION;
	}

	private static boolean rewritesEditorialDataWithoutMarker(Path path) {
		try {
			String sql = Files.readString(path, StandardCharsets.UTF_8);
			String normalizedSql = sql.toLowerCase(Locale.ROOT);
			return !sql.contains(REQUIRED_MARKER) && DESTRUCTIVE_EDITORIAL_STATEMENT.matcher(normalizedSql).find();
		} catch (IOException exception) {
			throw new IllegalStateException("Unable to read migration " + path, exception);
		}
	}
}
