package fr.lesroutesoubliees.routesoubliees.quest;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import fr.lesroutesoubliees.routesoubliees.shared.markdown.MarkdownRenderer;

class MarkdownRendererTests {

	private final MarkdownRenderer renderer = new MarkdownRenderer();

	@Test
	void escapesRawHtmlAndInlineHandlers() {
		var html = renderer.render("<img src=x onerror=alert(1)>\n\n<script>alert(1)</script>");

		assertThat(html).doesNotContain("<img", "<script", "onerror=");
		assertThat(html).contains("alert(1)");
	}

	@Test
	void rendersBasicAllowedMarkdown() {
		var html = renderer.render("""
			## Titre

			Un **indice** *important* avec `code`.

			- Premier point
			- Second point
			""");

		assertThat(html).contains("<h3>Titre</h3>");
		assertThat(html).contains("<strong>indice</strong>");
		assertThat(html).contains("<em>important</em>");
		assertThat(html).contains("<code>code</code>");
		assertThat(html).contains("<ul><li>Premier point</li><li>Second point</li></ul>");
	}

	@Test
	void dropsUnsafeLinksButKeepsLabel() {
		var html = renderer.render("Voir [indice](javascript:alert(1)) et [archive](/notebook/QUEST_1).");

		assertThat(html).doesNotContain("javascript:");
		assertThat(html).contains("indice");
		assertThat(html).contains("<a href=\"/notebook/QUEST_1\">archive</a>");
	}

	@Test
	void rendersOnlyRepositoryMediaImages() {
		var html = renderer.render("""
			![portrait](/media/11111111-1111-1111-1111-111111111111)
			![carte](/assets/maps/map-hidden.png)
			![svg](/assets/icons/piege.svg)
			![script](javascript:alert(1))
			""");

		assertThat(html).contains("<figure class=\"markdown-image markdown-image--full\"><img src=\"/media/11111111-1111-1111-1111-111111111111\" alt=\"portrait\"></figure>");
		assertThat(html).contains("<figure class=\"markdown-image markdown-image--full\"><img src=\"/assets/maps/map-hidden.png\" alt=\"carte\"></figure>");
		assertThat(html).doesNotContain("<img src=\"/assets/icons/piege.svg\"");
		assertThat(html).doesNotContain("javascript:");
		assertThat(html).contains("svg", "script");
	}

	@Test
	void rendersSafeMediaImageWithCaptionAndSize() {
		var html = renderer.render("![Portrait d'Elyra](/media/11111111-1111-1111-1111-111111111111 \"L'indice retrouve\"){size=medium}");

		assertThat(html).contains(
			"<figure class=\"markdown-image markdown-image--medium\"><img src=\"/media/11111111-1111-1111-1111-111111111111\" alt=\"Portrait d&#39;Elyra\"><figcaption>L&#39;indice retrouve</figcaption></figure>");
	}

	@Test
	void ignoresUnknownImageSizes() {
		var html = renderer.render("![portrait](/media/11111111-1111-1111-1111-111111111111 \"Titre\"){size=giant}");

		assertThat(html).doesNotContain("markdown-image--giant");
		assertThat(html).contains("{size=giant}");
	}
}
