import { PublicSiteSettings } from '../config/site-settings.models';
import { PublicHomeResponse } from '../../features/home/home-api.models';
import { PublicMapResponse } from '../../features/map/map-api.models';
import {
  PublicQuestDetail,
  PublicQuestSummary,
} from '../../features/notebook/notebook-api.models';

export interface PublicContentVersion {
  version: string;
}

export interface PublicOfflineSnapshot {
  version: string;
  settings: PublicSiteSettings;
  home: PublicHomeResponse;
  map: PublicMapResponse;
  quests: PublicQuestSummary[];
  questDetails: PublicQuestDetail[];
}
