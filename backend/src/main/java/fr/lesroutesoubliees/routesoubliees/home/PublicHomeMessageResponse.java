package fr.lesroutesoubliees.routesoubliees.home;

import java.time.OffsetDateTime;
import java.util.UUID;

public record PublicHomeMessageResponse(
	UUID id,
	String title,
	String contentHtml,
	String importance,
	boolean countdownEnabled,
	OffsetDateTime endsAt,
	String displayTimezone,
	String expiredMessage
) {
}
