package fr.lesroutesoubliees.routesoubliees.shared.config;

import java.time.Clock;
import java.time.ZoneOffset;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Horloge applicative injectable.
 *
 * <p>Les composants sensibles au temps (expiration des presences Radar, fraicheur des
 * releves) dependent de ce bean afin d'etre testables sans attente reelle.
 */
@Configuration(proxyBeanMethods = false)
public class TimeConfiguration {

	@Bean
	public Clock clock() {
		return Clock.system(ZoneOffset.UTC);
	}
}
