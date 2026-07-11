package fr.lesroutesoubliees.routesoubliees.auth;

class AdminAccessDeniedException extends RuntimeException {

	AdminAccessDeniedException(String message) {
		super(message);
	}
}
