package fr.lesroutesoubliees.routesoubliees.portal;

import java.util.UUID;

import jakarta.validation.constraints.NotNull;

record PortalAdventurerAssignmentRequest(@NotNull UUID adventurerId) {
}

record AdminPortalAssignmentRequest(@NotNull PortalAccessMode accessMode, UUID adventurerId) {
}
