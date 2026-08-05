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

export interface RadarLocationPayload {
  latitude: number;
  longitude: number;
  accuracyM: number;
  observedAt: string;
}
