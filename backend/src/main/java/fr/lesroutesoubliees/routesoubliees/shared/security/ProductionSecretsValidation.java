package fr.lesroutesoubliees.routesoubliees.shared.security;

import java.util.List;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;

/**
 * Interrompt le demarrage du profil prod lorsque les secrets exiges sont absents,
 * factices ou incoherents.
 */
@Configuration(proxyBeanMethods = false)
@Profile("prod")
class ProductionSecretsValidation {

	ProductionSecretsValidation(RadarHomeAssistantProperties radarHomeAssistant, Environment environment) {
		RadarHomeAssistantSecretValidator.validateForProduction(
			radarHomeAssistant.token(),
			List.of(environment.getActiveProfiles()));
	}
}
