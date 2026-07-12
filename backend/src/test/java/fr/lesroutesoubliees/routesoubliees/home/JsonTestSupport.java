package fr.lesroutesoubliees.routesoubliees.home;

import tools.jackson.databind.json.JsonMapper;

final class JsonTestSupport {

	private static final JsonMapper JSON = new JsonMapper();

	private JsonTestSupport() {
	}

	static String extractString(String content, String fieldName) throws Exception {
		return JSON.readTree(content).get(fieldName).asString();
	}
}
