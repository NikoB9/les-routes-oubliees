package fr.lesroutesoubliees.routesoubliees.map;

import java.math.BigDecimal;
import java.util.UUID;

interface MapMarkerPublicProjection {

	UUID getId();

	String getTitle();

	BigDecimal getPositionX();

	BigDecimal getPositionY();

	int getDisplayOrder();

	String getQuestCode();
}
