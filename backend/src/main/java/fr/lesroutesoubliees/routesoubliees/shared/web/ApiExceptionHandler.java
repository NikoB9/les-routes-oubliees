package fr.lesroutesoubliees.routesoubliees.shared.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;

/**
 * Filet de securite du contrat d'erreur.
 *
 * <p>Les exceptions connues de Spring MVC, dont {@link
 * org.springframework.web.server.ResponseStatusException}, sont deja rendues en
 * {@code application/problem+json} par {@code spring.mvc.problemdetails.enabled}. Ce
 * gestionnaire ne traite que ce qui resterait sans reponse structuree.
 *
 * <p><strong>Ordre volontairement le plus bas.</strong> Spring retient le premier
 * {@code @ControllerAdvice} possedant une methode compatible, sans comparer la precision
 * entre plusieurs advices : un {@code @ExceptionHandler(Exception.class)} declare avant
 * celui de Spring Boot capturerait aussi les erreurs de validation et detruirait leur
 * detail. La priorite la plus basse garantit que ce gestionnaire n'intervient qu'en
 * dernier recours.
 */
@Order(Ordered.LOWEST_PRECEDENCE)
@RestControllerAdvice
class ApiExceptionHandler {

	private static final Logger LOGGER = LoggerFactory.getLogger(ApiExceptionHandler.class);

	/** Message stable : le detail technique reste dans les journaux du serveur. */
	private static final String INTERNAL_DETAIL = "Une erreur interne est survenue.";

	/**
	 * Laisse Spring Security traduire le refus.
	 *
	 * <p>L'autorisation est portee par les regles d'URL, donc ce cas ne se produit
	 * normalement pas. Sans cette relance, l'ajout d'une securite par methode ferait
	 * apparaitre un {@code 500} la ou un {@code 403} est attendu, et le marqueur
	 * applicatif du {@code 401} serait perdu.
	 */
	@ExceptionHandler(AccessDeniedException.class)
	void rethrowAccessDenied(AccessDeniedException exception) {
		throw exception;
	}

	/**
	 * Deconnexion d'un client au milieu d'une reponse, cas normal des flux SSE : la reponse
	 * n'est plus utilisable, aucun corps ne peut etre ecrit et l'evenement n'est pas une
	 * erreur d'application.
	 */
	@ExceptionHandler(AsyncRequestNotUsableException.class)
	void handleClientDisconnection(AsyncRequestNotUsableException exception) {
		LOGGER.debug("Client deconnecte avant la fin de la reponse.", exception);
	}

	/** Toute exception non prevue : reponse generique, cause journalisee cote serveur. */
	@ExceptionHandler(Exception.class)
	ResponseEntity<ProblemDetail> handleUnexpectedException(Exception exception) {
		LOGGER.error("Erreur non geree.", exception);
		var problem = ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, INTERNAL_DETAIL);
		problem.setTitle("Internal Server Error");
		problem.setProperty("code", "internal-error");
		return ResponseEntity.internalServerError()
			.header(HttpHeaders.CACHE_CONTROL, "no-store")
			.body(problem);
	}
}
