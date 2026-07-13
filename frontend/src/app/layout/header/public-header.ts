import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { SiteSettingsApiService } from '../../core/config/site-settings-api.service';
import { PublicSiteSettings } from '../../core/config/site-settings.models';

@Component({
  selector: 'app-public-header',
  imports: [RouterLink],
  templateUrl: './public-header.html',
  styleUrl: './public-header.css',
})
export class PublicHeaderComponent {
  private readonly settingsApi = inject(SiteSettingsApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly fallbackLogo = '/assets/brand/logo-compagnie-des-routes-oubliees.png?v=12fa08d';
  protected readonly settings = signal<PublicSiteSettings>({
    siteName: 'Les Routes Oubliées',
    subtitle: "Compagnie d'Arkhavel",
    logoPath: this.fallbackLogo,
    timezone: 'Europe/Paris',
    status: 'ONLINE',
    maintenanceMessage: null,
    accessibilityInformationMarkdown: '',
  });

  constructor() {
    this.settingsApi
      .getPublicSettings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (settings) => this.settings.set(settings),
        error: () => undefined,
      });
  }
}
