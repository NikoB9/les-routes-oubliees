package fr.lesroutesoubliees.routesoubliees.map;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

record AdminMapMarkerUpsertRequest(
	@NotBlank
	@Pattern(regexp = "QUEST_1|QUEST_2|QUEST_3|QUEST_4|VAL_D_AURELUNE")
	String questCode,

	@NotBlank
	@Size(max = 160)
	String title,

	@NotNull
	@DecimalMin("0.000")
	@DecimalMax("100.000")
	BigDecimal positionX,

	@NotNull
	@DecimalMin("0.000")
	@DecimalMax("100.000")
	BigDecimal positionY,

	MapMarkerLabelPosition labelPosition,

	@Min(0)
	@Max(120)
	Integer labelOffsetPx,

	boolean active,

	@Min(1)
	@Max(999)
	int displayOrder
) {
}
