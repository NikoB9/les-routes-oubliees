package fr.lesroutesoubliees.routesoubliees.home;

import java.time.ZoneId;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import fr.lesroutesoubliees.routesoubliees.shared.EditorialStatus;
import fr.lesroutesoubliees.routesoubliees.shared.config.SiteProperties;

@Service
public class PublicHomeMessageService {

	private final HomeMessageRepository repository;
	private final SiteProperties siteProperties;

	PublicHomeMessageService(HomeMessageRepository repository, SiteProperties siteProperties) {
		this.repository = repository;
		this.siteProperties = siteProperties;
	}

	@Transactional(readOnly = true)
	public PublicHomeMessageResponse activeMessage() {
		return repository.findFirstByActiveTrueAndStatus(EditorialStatus.PUBLISHED)
			.map(this::toResponse)
			.orElse(null);
	}

	private PublicHomeMessageResponse toResponse(HomeMessage message) {
		var timezone = ZoneId.of(siteProperties.timezone()).getId();
		return new PublicHomeMessageResponse(
			message.id(),
			message.title(),
			message.contentMarkdown(),
			message.importance().name(),
			message.countdownEnabled(),
			message.endsAt(),
			timezone,
			message.expiredMessage());
	}
}
