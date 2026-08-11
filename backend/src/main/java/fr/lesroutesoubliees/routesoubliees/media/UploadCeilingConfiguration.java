package fr.lesroutesoubliees.routesoubliees.media;

import jakarta.servlet.MultipartConfigElement;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import fr.lesroutesoubliees.routesoubliees.shared.config.SiteProperties;

/**
 * Aligne le plafond du conteneur servlet sur les plafonds applicatifs.
 *
 * <p>Sans cette configuration, trois limites se superposaient sans se connaitre : Nginx a
 * 10 Mio, le conteneur servlet au defaut de Spring Boot — 1 Mio — et l'application a son propre
 * plafond. Le conteneur rejetant pendant l'analyse du multipart, la validation applicative
 * n'etait jamais atteinte au-dela d'un Mio : la valeur configuree ne servait a rien, et une photo
 * de telephone ordinaire etait refusee.
 *
 * <p>Le plafond est donc <strong>derive</strong> et non recopie. Deux proprietes a tenir
 * synchronisees a la main auraient rouvert le meme ecart.
 *
 * <p>Il y a desormais deux plafonds applicatifs — les medias et les documents d'organisation des
 * quetes — pour un seul reglage de conteneur, forcement commun a toutes les requetes. C'est le
 * <strong>maximum</strong> qui est retenu : borner au minimum ferait rejeter par le conteneur des
 * fichiers que l'application accepte, et le controle applicatif, plus precis, resterait
 * inaccessible. Chaque endpoint applique ensuite le sien, avec son propre message.
 */
@Configuration(proxyBeanMethods = false)
class UploadCeilingConfiguration {

	/**
	 * Marge du corps multipart au-dela du fichier lui-meme.
	 *
	 * <p>La requete transporte aussi un champ texte — texte alternatif ou libelle — les
	 * delimiteurs et les en-tetes de parties. Sans cette marge, un fichier pesant exactement le
	 * plafond serait refuse sur la taille de requete, et le controle applicatif resterait
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
		var maxFileSize = Math.max(properties.mediaMaxUploadBytes(), properties.questDocumentMaxUploadBytes());
		return new MultipartConfigElement(null, maxFileSize, maxFileSize + MULTIPART_OVERHEAD_BYTES, 0);
	}
}
