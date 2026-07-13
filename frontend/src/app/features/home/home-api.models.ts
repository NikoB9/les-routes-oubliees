export interface PublicHomeResponse {
  message: PublicHomeMessage | null;
  company: PublicCompany | null;
  adventurers: PublicAdventurer[];
}

export interface PublicHomeMessage {
  id: string;
  title: string;
  contentHtml: string;
  importance: HomeMessageImportance;
  countdownEnabled: boolean;
  endsAt: string | null;
  displayTimezone: string;
  expiredMessage: string | null;
}

export type HomeMessageImportance =
  | 'INFORMATION'
  | 'WARNING'
  | 'QUEST_IMMINENT'
  | 'SUCCESS'
  | 'MYSTERY';

export interface PublicCompany {
  id: string;
  name: string;
  emblemPath: string | null;
  imageAlt: string | null;
  shortDescription: string;
  longDescriptionHtml: string;
}

export interface PublicAdventurer {
  id: string;
  name: string;
  title: string;
  avatarPath: string | null;
  avatarAlt: string | null;
  shortDescription: string;
  strengths: string;
  weaknesses: string;
  displayOrder: number;
}
