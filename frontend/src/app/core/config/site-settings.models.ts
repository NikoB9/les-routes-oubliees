export type SiteStatus = 'ONLINE' | 'MAINTENANCE';

export interface PublicSiteSettings {
  siteName: string;
  subtitle: string | null;
  logoPath: string | null;
  timezone: string;
  status: SiteStatus;
  maintenanceMessage: string | null;
  accessibilityInformationMarkdown: string;
}
