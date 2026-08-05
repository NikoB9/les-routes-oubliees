export type PortalAccessMode = 'UNASSIGNED' | 'ADVENTURER' | 'GUEST';

export interface PortalIdentity {
  id: string;
  accessMode: PortalAccessMode;
  adventurerId: string | null;
  displayName: string | null;
  avatarPath: string | null;
  selectedAt: string | null;
}

export interface PortalAdventurerChoice {
  id: string;
  name: string;
  title: string;
  avatarPath: string | null;
  avatarAlt: string | null;
}

export interface PortalMe {
  identity: PortalIdentity;
  availableAdventurers: PortalAdventurerChoice[];
  guestAvailable: boolean;
}
