package fr.lesroutesoubliees.routesoubliees.home;

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
@RequestMapping("/api/admin/home/messages")
class AdminHomeMessageController {

	private final AdminHomeMessageService messages;
	private final AdminIdentity identity;

	AdminHomeMessageController(AdminHomeMessageService messages, AdminIdentity identity) {
		this.messages = messages;
		this.identity = identity;
	}

	@GetMapping
	List<AdminHomeMessageResponse> listMessages() {
		return messages.listMessages();
	}

	@PostMapping
	AdminHomeMessageResponse createMessage(
		@Valid @RequestBody AdminHomeMessageUpsertRequest request,
		Authentication authentication
	) {
		return messages.createMessage(request, identity.email(authentication));
	}

	@PutMapping("/{id}")
	AdminHomeMessageResponse updateMessage(
		@PathVariable UUID id,
		@Valid @RequestBody AdminHomeMessageUpsertRequest request,
		Authentication authentication
	) {
		return messages.updateMessage(id, request, identity.email(authentication));
	}

	@PostMapping("/{id}/activate")
	AdminHomeMessageResponse activateMessage(@PathVariable UUID id, Authentication authentication) {
		return messages.activateMessage(id, identity.email(authentication));
	}

	@DeleteMapping("/{id}")
	void deleteMessage(@PathVariable UUID id, Authentication authentication) {
		messages.deleteMessage(id, identity.email(authentication));
	}
}
