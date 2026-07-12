package fr.lesroutesoubliees.routesoubliees.media;

import org.springframework.core.io.Resource;

record StoredMedia(MediaAsset asset, Resource resource) {}
