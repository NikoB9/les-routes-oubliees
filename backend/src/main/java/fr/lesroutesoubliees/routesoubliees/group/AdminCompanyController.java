package fr.lesroutesoubliees.routesoubliees.group;

import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import fr.lesroutesoubliees.routesoubliees.auth.AdminIdentity;
import jakarta.validation.Valid;

@Validated
@RestController
@RequestMapping("/api/admin/group")
class AdminCompanyController {

	private final AdminCompanyService company;
	private final AdminIdentity identity;

	AdminCompanyController(AdminCompanyService company, AdminIdentity identity) {
		this.company = company;
		this.identity = identity;
	}

	@GetMapping
	AdminCompanyResponse getCompany() {
		return company.getCompany();
	}

	@PutMapping
	AdminCompanyResponse updateCompany(
		@Valid @RequestBody AdminCompanyUpdateRequest request,
		Authentication authentication
	) {
		return company.updateCompany(request, identity.email(authentication));
	}
}
