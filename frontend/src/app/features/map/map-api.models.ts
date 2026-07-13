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
  displayOrder: number;
  questCode: string;
}
