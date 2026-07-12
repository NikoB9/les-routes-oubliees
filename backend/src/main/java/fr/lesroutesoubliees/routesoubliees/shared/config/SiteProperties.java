package fr.lesroutesoubliees.routesoubliees.shared.config;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "routes-oubliees")
public record SiteProperties(
	String mediaStoragePath,
	long mediaMaxUploadBytes,
	String publicUrl,
	String timezone,
	List<String> adminBootstrapEmails
) {}
