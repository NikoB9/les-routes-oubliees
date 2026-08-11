package fr.lesroutesoubliees.routesoubliees.shared.config;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Reglages du site.
 *
 * <p>Les deux plafonds de televersement sont distincts : une image publique et un dossier
 * d'organisation scanne n'ont pas le meme ordre de grandeur, et confondre les deux obligerait a
 * ouvrir l'un pour satisfaire l'autre. Le conteneur servlet, lui, n'en connait qu'un — voir
 * {@code UploadCeilingConfiguration}, qui le derive du plus permissif des deux.
 */
@ConfigurationProperties(prefix = "routes-oubliees")
public record SiteProperties(
	String mediaStoragePath,
	long mediaMaxUploadBytes,
	long questDocumentMaxUploadBytes,
	String publicUrl,
	String timezone,
	List<String> adminBootstrapEmails
) {}
