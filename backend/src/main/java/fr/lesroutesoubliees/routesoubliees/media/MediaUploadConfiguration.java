package fr.lesroutesoubliees.routesoubliees.media;

import jakarta.servlet.MultipartConfigElement;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import fr.lesroutesoubliees.routesoubliees.shared.config.SiteProperties;

/**
 * Aligne le plafond du conteneur servlet sur le plafond applicatif.
 *
 * <p>Sans cette configuration, trois limites se superposaient sans se connaitre : Nginx a
 * 10 Mio, le conteneur servlet au defaut de Spring Boot — 1 Mio — et l'application a
 * {@code routes-oubliees.media-max-upload-bytes}, soit 5 Mio. Le conteneur rejetant pendant
 * l'analyse du multipart, {@link MediaService#upload} n'etait jamais atteint au-dela d'un
 * Mio : la valeur configuree ne servait a rien, et une photo de telephone ordinaire etait
 * refusee.
 *
 * <p>Le plafond est donc <strong>derive</strong> et non recopie. Deux proprietes a tenir
 * synchronisees a la main auraient rouvert le meme ecart.
 */
@Configuration(proxyBeanMethods = false)
class MediaUploadConfiguration {

	/**
	 * Marge du corps multipart au-dela du fichier lui-meme.
	 *
	 * <p>La requete transporte aussi le champ {@code altText} — 280 caracteres au plus — les
	 * delimiteurs et les en-tetes de parties. Sans cette marge, un fichier pesant exactement
	 * le plafond serait refuse sur la taille de requete, et le controle applicatif resterait
	 * inaccessible sur ses derniers octets.
	 */
	static final long MULTIPART_OVERHEAD_BYTES = 16L * 1024;

	/**
	 * Remplace le {@code MultipartConfigElement} de Spring Boot, declare
	 * {@code @ConditionalOnMissingBean}.
	 *
	 * <p>Seuil de bascule sur disque a zero, comme le defaut du demarreur : aucun corps
	 * televerse n'est conserve en memoire.
	 */
	@Bean
	MultipartConfigElement multipartConfigElement(SiteProperties properties) {
		var maxFileSize = properties.mediaMaxUploadBytes();
		return new MultipartConfigElement(null, maxFileSize, maxFileSize + MULTIPART_OVERHEAD_BYTES, 0);
	}
}
