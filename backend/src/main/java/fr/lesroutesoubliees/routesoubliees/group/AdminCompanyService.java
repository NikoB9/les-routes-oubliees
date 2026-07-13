package fr.lesroutesoubliees.routesoubliees.group;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import fr.lesroutesoubliees.routesoubliees.audit.AuditService;

@Service
public class AdminCompanyService {

	private final CompanyProfileRepository repository;
	private final AuditService audit;

	AdminCompanyService(CompanyProfileRepository repository, AuditService audit) {
		this.repository = repository;
		this.audit = audit;
	}

	@Transactional(readOnly = true)
	public AdminCompanyResponse getCompany() {
		return repository.findFirstByActiveTrue()
			.or(() -> repository.findAllByOrderByUpdatedAtDesc().stream().findFirst())
			.map(this::toResponse)
			.orElseGet(this::emptyCompanyResponse);
	}

	@Transactional
	public AdminCompanyResponse updateCompany(AdminCompanyUpdateRequest request, String actorEmail) {
		var company = repository.findFirstByActiveTrue()
			.or(() -> repository.findAllByOrderByUpdatedAtDesc().stream().findFirst())
			.orElseGet(() -> new CompanyProfile(
				UUID.randomUUID(),
				request.name().trim(),
				trimToNull(request.emblemPath()),
				trimToNull(request.imageAlt()),
				request.shortDescription().trim(),
				request.longDescriptionMarkdown().trim(),
				true));
		repository.findByActiveTrue().stream()
			.filter(activeCompany -> !activeCompany.id().equals(company.id()))
			.forEach(CompanyProfile::deactivate);
		company.update(
			request.name().trim(),
			trimToNull(request.emblemPath()),
			trimToNull(request.imageAlt()),
			request.shortDescription().trim(),
			request.longDescriptionMarkdown().trim(),
			true);
		repository.save(company);
		audit.record(actorEmail, "COMPANY_UPDATED", "COMPANY", company.id().toString(), "Compagnie modifiée");
		return toResponse(company);
	}

	private String trimToNull(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		return value.trim();
	}

	private AdminCompanyResponse emptyCompanyResponse() {
		return new AdminCompanyResponse(null, "", null, null, "", "", false, null, null);
	}

	private AdminCompanyResponse toResponse(CompanyProfile company) {
		return new AdminCompanyResponse(
			company.id(),
			company.name(),
			company.emblemPath(),
			company.imageAlt(),
			company.shortDescription(),
			company.longDescriptionMarkdown(),
			company.active(),
			company.createdAt(),
			company.updatedAt());
	}
}
