package fr.lesroutesoubliees.routesoubliees.shared.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "routes-oubliees.cloudflare-access")
public record CloudflareAccessProperties(
	String issuer,
	String audience,
	String certsUrl
) {
}
