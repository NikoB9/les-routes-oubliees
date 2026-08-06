package fr.lesroutesoubliees.routesoubliees.shared.security;

import java.util.List;
import java.util.Locale;

import org.springframework.util.StringUtils;

/**
 * Controle de coherence du secret Bearer Home Assistant exige en production.
 *
 * <p>Le secret attendu provient de 32 octets aleatoires encodes en base64url, soit 43
 * caracteres. Une longueur ne demontre pas l'entropie : seules l'absence, une valeur
 * factice et une longueur incoherente avec cet encodage sont detectables ici.
 *
 * <p>Aucun message d'erreur ne reproduit la valeur inspectee.
 */
final class RadarHomeAssistantSecretValidator {

	/** Longueur minimale : 32 octets aleatoires encodes en base64url. */
	static final int MINIMUM_LENGTH = 43;

	private static final List<String> REJECTED_FRAGMENTS = List.of(
		"change-me", "changeme", "a-changer", "placeholder", "example", "sample",
		"dev-", "demo", "test", "secret", "password", "token-here");

	private RadarHomeAssistantSecretValidator() {
	}

	/**
	 * Valide le secret pour un demarrage en production.
	 *
	 * @param token secret configure, potentiellement absent
	 * @param activeProfiles profils Spring actifs
	 * @throws IllegalStateException si le secret est absent, factice, trop court, ou si un
	 *     profil de developpement est actif en meme temps que la production
	 */
	static void validateForProduction(String token, List<String> activeProfiles) {
		if (activeProfiles != null && activeProfiles.contains("dev")) {
			throw new IllegalStateException(
				"Le profil dev ne doit jamais etre actif avec le profil prod : l'identite de developpement contournerait Cloudflare Access.");
		}
		if (!StringUtils.hasText(token)) {
			throw new IllegalStateException(
				"RADAR_HOME_ASSISTANT_TOKEN est obligatoire en production et ne doit pas etre vide.");
		}
		var normalized = token.trim().toLowerCase(Locale.ROOT);
		for (var fragment : REJECTED_FRAGMENTS) {
			if (normalized.contains(fragment)) {
				throw new IllegalStateException(
					"RADAR_HOME_ASSISTANT_TOKEN contient une valeur factice reconnaissable : generer 32 octets aleatoires encodes en base64url.");
			}
		}
		if (token.trim().length() < MINIMUM_LENGTH) {
			throw new IllegalStateException(
				"RADAR_HOME_ASSISTANT_TOKEN est trop court : au moins " + MINIMUM_LENGTH
					+ " caracteres, soit 32 octets aleatoires encodes en base64url.");
		}
	}
}
