package fr.lesroutesoubliees.routesoubliees.quest;

import org.springframework.core.io.Resource;

/** Metadonnees et contenu d'un document, rendus ensemble pour n'ouvrir le fichier qu'une fois. */
record StoredQuestDocument(QuestDocument document, Resource resource) {}
