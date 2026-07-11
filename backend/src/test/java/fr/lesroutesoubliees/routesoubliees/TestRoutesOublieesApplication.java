package fr.lesroutesoubliees.routesoubliees;

import org.springframework.boot.SpringApplication;

public class TestRoutesOublieesApplication {

	public static void main(String[] args) {
		SpringApplication.from(RoutesOublieesApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
