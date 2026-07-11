package fr.lesroutesoubliees.routesoubliees.home;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import fr.lesroutesoubliees.routesoubliees.adventurer.PublicAdventurerService;
import fr.lesroutesoubliees.routesoubliees.group.PublicCompanyService;

@RestController
@RequestMapping("/api/public/home")
class PublicHomeController {

	private final PublicHomeMessageService messages;
	private final PublicCompanyService companies;
	private final PublicAdventurerService adventurers;

	PublicHomeController(
		PublicHomeMessageService messages,
		PublicCompanyService companies,
		PublicAdventurerService adventurers
	) {
		this.messages = messages;
		this.companies = companies;
		this.adventurers = adventurers;
	}

	@GetMapping
	PublicHomeResponse getHome() {
		return new PublicHomeResponse(
			messages.activeMessage(),
			companies.activeCompany(),
			adventurers.visibleAdventurers());
	}
}
