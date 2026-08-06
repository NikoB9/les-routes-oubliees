package fr.lesroutesoubliees.routesoubliees.shared.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

class ApiExceptionHandlerTests {

	private final ApiExceptionHandler handler = new ApiExceptionHandler();

	/**
	 * Le message d'une exception peut contenir une requete, un chemin ou une valeur de
	 * configuration : il reste dans les journaux du serveur, jamais dans la reponse.
	 */
	@Test
	void unexpectedExceptionNeverLeaksItsMessage() {
		var response = handler.handleUnexpectedException(
			new IllegalStateException("jdbc:postgresql://hote/base?password=secret"));

		assertThat(response.getStatusCode().value()).isEqualTo(500);
		assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
		var problem = response.getBody();
		assertThat(problem).isNotNull();
		assertThat(problem.getDetail())
			.isEqualTo("Une erreur interne est survenue.")
			.doesNotContain("secret");
		assertThat(problem.getProperties()).containsEntry("code", "internal-error");
	}

	/**
	 * Sans relance, l'ajout d'une securite par methode ferait apparaitre un {@code 500} la ou
	 * un {@code 403} est attendu, et le marqueur applicatif du {@code 401} serait perdu.
	 */
	@Test
	void accessDeniedIsLeftToSpringSecurity() {
		var denied = new AccessDeniedException("refus");

		assertThatThrownBy(() -> handler.rethrowAccessDenied(denied)).isSameAs(denied);
	}
}
