export interface PublicMapResponse {
  vision: PublicMapVision | null;
  markers: PublicMapMarker[];
}

export interface PublicMapVision {
  id: string;
  name: string;
  descriptionHtml: string;
  assetPath: string;
  imageAlt: string;
  displayOrder: number;
}

export interface PublicMapMarker {
  id: string;
  title: string;
  positionX: number;
  positionY: number;
  labelPosition: MapMarkerLabelPosition;
  labelOffsetPx: number;
  displayOrder: number;
  questCode: string;
}

export type MapMarkerLabelPosition = 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';
