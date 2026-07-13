package fr.lesroutesoubliees.routesoubliees.quest;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

@Component
class MarkdownRenderer {

	private static final Pattern IMAGE = Pattern.compile(
		"!\\[([^\\]]{0,280})]\\(([^\\s()\"]+(?:\\([^\\s()]*\\)[^\\s()]*)*)(?:\\s+&quot;((?:(?!&quot;).){0,240})&quot;)?\\)(?:\\{size=(small|medium|large|full)\\})?");
	private static final Pattern LINK = Pattern.compile("\\[([^\\]]{1,160})]\\(([^\\s()]+(?:\\([^\\s()]*\\)[^\\s()]*)*)\\)");
	private static final Pattern CODE = Pattern.compile("`([^`]{1,160})`");
	private static final Pattern STRONG = Pattern.compile("\\*\\*([^*]+)\\*\\*");
	private static final Pattern EMPHASIS = Pattern.compile("(?<!\\*)\\*([^*]+)\\*(?!\\*)");
	private static final Pattern RAW_HTML = Pattern.compile("<[^>]*>");
	private static final Pattern MEDIA_IMAGE = Pattern.compile("^/media/[0-9a-fA-F-]{36}$");
	private static final Pattern VERSIONED_IMAGE = Pattern.compile("^/assets/[A-Za-z0-9/_-]+\\.(png|jpg|jpeg|webp)$", Pattern.CASE_INSENSITIVE);

	String render(String markdown) {
		if (markdown == null || markdown.isBlank()) {
			return "";
		}

		var html = new StringBuilder();
		var paragraph = new ArrayList<String>();
		var list = new ArrayList<String>();
		var quote = new ArrayList<String>();

		for (var rawLine : markdown.replace("\r\n", "\n").split("\n")) {
			var line = rawLine.trim();
			if (line.isEmpty()) {
				flushParagraph(html, paragraph);
				flushList(html, list);
				flushQuote(html, quote);
				continue;
			}

			var headingLevel = headingLevel(line);
			if (headingLevel > 0) {
				flushParagraph(html, paragraph);
				flushList(html, list);
				flushQuote(html, quote);
				var text = line.substring(headingLevel + 1).trim();
				html.append("<h").append(headingLevel + 1).append(">")
					.append(inline(text))
					.append("</h").append(headingLevel + 1).append(">");
				continue;
			}

			if (line.startsWith("- ") || line.startsWith("* ")) {
				flushParagraph(html, paragraph);
				flushQuote(html, quote);
				list.add(line.substring(2).trim());
				continue;
			}

			if (line.startsWith("> ")) {
				flushParagraph(html, paragraph);
				flushList(html, list);
				quote.add(line.substring(2).trim());
				continue;
			}

			flushList(html, list);
			flushQuote(html, quote);
			paragraph.add(line);
		}

		flushParagraph(html, paragraph);
		flushList(html, list);
		flushQuote(html, quote);

		return html.toString();
	}

	private int headingLevel(String line) {
		if (line.startsWith("# ")) {
			return 1;
		}
		if (line.startsWith("## ")) {
			return 2;
		}
		if (line.startsWith("### ")) {
			return 3;
		}
		return 0;
	}

	private void flushParagraph(StringBuilder html, List<String> lines) {
		if (lines.isEmpty()) {
			return;
		}
		var rendered = inline(String.join(" ", lines));
		if (rendered.startsWith("<figure class=\"markdown-image ") && rendered.endsWith("</figure>")) {
			html.append(rendered);
		} else {
			html.append("<p>").append(rendered).append("</p>");
		}
		lines.clear();
	}

	private void flushList(StringBuilder html, List<String> items) {
		if (items.isEmpty()) {
			return;
		}
		html.append("<ul>");
		for (var item : items) {
			html.append("<li>").append(inline(item)).append("</li>");
		}
		html.append("</ul>");
		items.clear();
	}

	private void flushQuote(StringBuilder html, List<String> lines) {
		if (lines.isEmpty()) {
			return;
		}
		html.append("<blockquote><p>").append(inline(String.join(" ", lines))).append("</p></blockquote>");
		lines.clear();
	}

	private String inline(String text) {
		var escaped = HtmlUtils.htmlEscape(RAW_HTML.matcher(text).replaceAll(""));
		escaped = safeImages(escaped);
		escaped = safeLinks(escaped);
		escaped = CODE.matcher(escaped).replaceAll("<code>$1</code>");
		escaped = STRONG.matcher(escaped).replaceAll("<strong>$1</strong>");
		return EMPHASIS.matcher(escaped).replaceAll("<em>$1</em>");
	}

	private String safeImages(String escaped) {
		var matcher = IMAGE.matcher(escaped);
		var rendered = new StringBuilder();
		while (matcher.find()) {
			var alt = matcher.group(1);
			var src = matcher.group(2);
			var title = matcher.group(3);
			var size = matcher.group(4) == null ? "full" : matcher.group(4);
			var replacement = isSafeImageUrl(src)
				? imageHtml(src, alt, title, size)
				: alt;
			matcher.appendReplacement(rendered, Matcher.quoteReplacement(replacement));
		}
		matcher.appendTail(rendered);
		return rendered.toString();
	}

	private String imageHtml(String src, String alt, String title, String size) {
		var html = new StringBuilder("<figure class=\"markdown-image markdown-image--")
			.append(size)
			.append("\"><img src=\"")
			.append(src)
			.append("\" alt=\"")
			.append(alt)
			.append("\">");
		if (title != null && !title.isBlank()) {
			html.append("<figcaption>").append(title).append("</figcaption>");
		}
		return html.append("</figure>").toString();
	}

	private String safeLinks(String escaped) {
		var matcher = LINK.matcher(escaped);
		var rendered = new StringBuilder();
		while (matcher.find()) {
			var label = matcher.group(1);
			var href = matcher.group(2);
			var replacement = isSafeUrl(href)
				? "<a href=\"" + href + "\">" + label + "</a>"
				: label;
			matcher.appendReplacement(rendered, Matcher.quoteReplacement(replacement));
		}
		matcher.appendTail(rendered);
		return rendered.toString();
	}

	private boolean isSafeUrl(String href) {
		var lower = href.toLowerCase();
		return lower.startsWith("https://")
			|| lower.startsWith("http://")
			|| lower.startsWith("mailto:")
			|| lower.startsWith("/")
			|| lower.startsWith("#");
	}

	private boolean isSafeImageUrl(String src) {
		return MEDIA_IMAGE.matcher(src).matches() || VERSIONED_IMAGE.matcher(src).matches();
	}
}
