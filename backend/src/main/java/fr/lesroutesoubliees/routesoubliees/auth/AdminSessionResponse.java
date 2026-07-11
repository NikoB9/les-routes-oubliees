package fr.lesroutesoubliees.routesoubliees.auth;

public record AdminSessionResponse(boolean authenticated, String email) {
}
