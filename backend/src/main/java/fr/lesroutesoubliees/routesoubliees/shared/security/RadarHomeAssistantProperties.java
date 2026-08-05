package fr.lesroutesoubliees.routesoubliees.shared.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "routes-oubliees.radar.home-assistant")
public record RadarHomeAssistantProperties(String token) {
}
