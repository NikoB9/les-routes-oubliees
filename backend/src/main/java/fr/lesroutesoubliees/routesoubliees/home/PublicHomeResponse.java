package fr.lesroutesoubliees.routesoubliees.home;

import java.util.List;

import fr.lesroutesoubliees.routesoubliees.adventurer.PublicAdventurerResponse;
import fr.lesroutesoubliees.routesoubliees.group.PublicCompanyResponse;

public record PublicHomeResponse(
	PublicHomeMessageResponse message,
	PublicCompanyResponse company,
	List<PublicAdventurerResponse> adventurers
) {
}
