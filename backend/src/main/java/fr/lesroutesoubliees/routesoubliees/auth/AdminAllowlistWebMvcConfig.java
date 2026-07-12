package fr.lesroutesoubliees.routesoubliees.auth;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
class AdminAllowlistWebMvcConfig implements WebMvcConfigurer {

	private final AdminAllowlistInterceptor interceptor;

	AdminAllowlistWebMvcConfig(AdminAllowlistInterceptor interceptor) {
		this.interceptor = interceptor;
	}

	@Override
	public void addInterceptors(InterceptorRegistry registry) {
		registry.addInterceptor(interceptor)
			.addPathPatterns("/api/admin/**");
	}
}
