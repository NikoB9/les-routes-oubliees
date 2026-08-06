package fr.lesroutesoubliees.routesoubliees.shared.security;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;

class RadarHomeAssistantSecretValidatorTests {

	private static final List<String> PRODUCTION_ONLY = List.of("prod");

	/** 43 caracteres : 32 octets aleatoires encodes en base64url. */
	private static final String VALID_SECRET = "kQ3rV9wYb1Nd7Hs2Lp0Zx6Cf4Gj8Mq5Tu1Aw3Ey7Ri9";

	@Test
	void rejectsMissingSecret() {
		assertThatThrownBy(() -> RadarHomeAssistantSecretValidator.validateForProduction(null, PRODUCTION_ONLY))
			.isInstanceOf(IllegalStateException.class)
			.hasMessageContaining("obligatoire");
	}

	@Test
	void rejectsEmptyOrBlankSecret() {
		for (var candidate : List.of("", " ", "\t")) {
			assertThatThrownBy(() -> RadarHomeAssistantSecretValidator.validateForProduction(candidate, PRODUCTION_ONLY))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("obligatoire");
		}
	}

	@Test
	void rejectsPlaceholderSecretsEvenWhenLongEnough() {
		var candidates = List.of(
			"dev-radar-home-assistant-token-change-me-0123456789",
			"change-me-with-a-random-256-bit-secret-please-now",
			"radar-home-assistant-token-for-example-purposes-only",
			"integration-test-home-assistant-bearer-0123456789abcdef");

		for (var candidate : candidates) {
			assertThatThrownBy(() -> RadarHomeAssistantSecretValidator.validateForProduction(candidate, PRODUCTION_ONLY))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("factice");
		}
	}

	@Test
	void rejectsSecretShorterThanTheDocumentedEncoding() {
		var tooShort = VALID_SECRET.substring(0, RadarHomeAssistantSecretValidator.MINIMUM_LENGTH - 1);

		assertThatThrownBy(() -> RadarHomeAssistantSecretValidator.validateForProduction(tooShort, PRODUCTION_ONLY))
			.isInstanceOf(IllegalStateException.class)
			.hasMessageContaining("trop court");
	}

	@Test
	void neverRepeatsTheInspectedValueInErrorMessages() {
		assertThatThrownBy(() -> RadarHomeAssistantSecretValidator.validateForProduction("abcdef", PRODUCTION_ONLY))
			.isInstanceOf(IllegalStateException.class)
			.hasMessageNotContaining("abcdef");
	}

	@Test
	void rejectsDevelopmentProfileActiveAlongsideProduction() {
		assertThatThrownBy(() ->
			RadarHomeAssistantSecretValidator.validateForProduction(VALID_SECRET, List.of("prod", "dev")))
			.isInstanceOf(IllegalStateException.class)
			.hasMessageContaining("profil dev");
	}

	@Test
	void acceptsSecretGeneratedFromThirtyTwoRandomBytes() {
		assertThatCode(() -> RadarHomeAssistantSecretValidator.validateForProduction(VALID_SECRET, PRODUCTION_ONLY))
			.doesNotThrowAnyException();
	}
}
