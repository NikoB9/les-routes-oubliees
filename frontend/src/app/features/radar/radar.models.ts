import { PortalAccessMode } from '../../core/portal/portal.models';

export interface RadarIdentity {
  identityId: string;
  accessMode: PortalAccessMode;
  adventurerId: string | null;
  displayName: string;
  avatarPath: string | null;
}

export interface RadarTreasure {
  latitude: number;
  longitude: number;
  accuracyM: number;
  observedAt: string;
  receivedAt: string;
  stale: boolean;
}

export interface RadarParticipant extends RadarIdentity {
  latitude: number;
  longitude: number;
  accuracyM: number;
  observedAt: string;
  receivedAt: string;
  stale: boolean;
}

export interface RadarSnapshot {
  serverTime: string;
  currentIdentity: RadarIdentity | null;
  treasure: RadarTreasure | null;
  participants: RadarParticipant[];
}

/**
 * Événement du flux Radar, état de la liaison compris.
 *
 * L'état du lien est une valeur émise et non un état caché du service : une reconnexion est
 * ainsi observable par la page, et vérifiable en test sans horloge réelle.
 */
export type RadarStreamEvent =
  | { readonly kind: 'snapshot'; readonly snapshot: RadarSnapshot }
  | { readonly kind: 'connected' }
  | { readonly kind: 'reconnecting' };

export interface RadarLocationPayload {
  latitude: number;
  longitude: number;
  accuracyM: number;
  observedAt: string;
}
