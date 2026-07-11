package fr.lesroutesoubliees.routesoubliees.group;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PublicCompanyService {

	private final CompanyProfileRepository repository;

	PublicCompanyService(CompanyProfileRepository repository) {
		this.repository = repository;
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
			company.longDescriptionMarkdown());
	}
}
