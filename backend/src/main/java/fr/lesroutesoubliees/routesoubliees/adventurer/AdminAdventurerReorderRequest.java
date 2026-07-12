package fr.lesroutesoubliees.routesoubliees.adventurer;

import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.NotEmpty;

record AdminAdventurerReorderRequest(@NotEmpty List<UUID> orderedIds) {
}
