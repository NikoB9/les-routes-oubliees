package fr.lesroutesoubliees.routesoubliees;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@ConfigurationPropertiesScan
@SpringBootApplication
public class RoutesOublieesApplication {

	public static void main(String[] args) {
		SpringApplication.run(RoutesOublieesApplication.class, args);
	}

}
