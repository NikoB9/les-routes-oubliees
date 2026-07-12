package fr.lesroutesoubliees.routesoubliees.adventurer;

import java.util.List;
import java.util.UUID;

import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import fr.lesroutesoubliees.routesoubliees.auth.AdminIdentity;
import jakarta.validation.Valid;

@Validated
@RestController
@RequestMapping("/api/admin/adventurers")
class AdminAdventurerController {

	private final AdminAdventurerService adventurers;
	private final AdminIdentity identity;

	AdminAdventurerController(AdminAdventurerService adventurers, AdminIdentity identity) {
		this.adventurers = adventurers;
		this.identity = identity;
	}

	@GetMapping
	List<AdminAdventurerResponse> listAdventurers() {
		return adventurers.listAdventurers();
	}

	@PostMapping
	AdminAdventurerResponse createAdventurer(
		@Valid @RequestBody AdminAdventurerUpsertRequest request,
		Authentication authentication
	) {
		return adventurers.createAdventurer(request, identity.email(authentication));
	}

	@PutMapping("/{id}")
	AdminAdventurerResponse updateAdventurer(
		@PathVariable UUID id,
		@Valid @RequestBody AdminAdventurerUpsertRequest request,
		Authentication authentication
	) {
		return adventurers.updateAdventurer(id, request, identity.email(authentication));
	}

	@PutMapping("/reorder")
	List<AdminAdventurerResponse> reorderAdventurers(
		@Valid @RequestBody AdminAdventurerReorderRequest request,
		Authentication authentication
	) {
		return adventurers.reorderAdventurers(request, identity.email(authentication));
	}

	@DeleteMapping("/{id}")
	void deleteAdventurer(@PathVariable UUID id, Authentication authentication) {
		adventurers.deleteAdventurer(id, identity.email(authentication));
	}
}
