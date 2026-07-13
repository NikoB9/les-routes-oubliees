package fr.lesroutesoubliees.routesoubliees.group;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import fr.lesroutesoubliees.routesoubliees.shared.markdown.MarkdownRenderer;

@Service
public class PublicCompanyService {

	private final CompanyProfileRepository repository;
	private final MarkdownRenderer markdownRenderer;

	PublicCompanyService(CompanyProfileRepository repository, MarkdownRenderer markdownRenderer) {
		this.repository = repository;
		this.markdownRenderer = markdownRenderer;
	}

	@Transactional(readOnly = true)
	public PublicCompanyResponse activeCompany() {
		return repository.findFirstByActiveTrue()
			.map(this::toResponse)
			.orElse(null);
	}

	private PublicCompanyResponse toResponse(CompanyProfile company) {
		return new PublicCompanyResponse(
			company.id(),
			company.name(),
			company.emblemPath(),
			company.imageAlt(),
			company.shortDescription(),
			markdownRenderer.render(company.longDescriptionMarkdown()));
	}
}
