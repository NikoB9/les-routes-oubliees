import { Component, DestroyRef, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { SiteSettingsApiService } from '../../core/config/site-settings-api.service';
import { PublicSiteSettings } from '../../core/config/site-settings.models';
import { PortalIdentityStore } from '../../core/portal/portal-identity.store';

@Component({
  selector: 'app-public-header',
  imports: [RouterLink],
  templateUrl: './public-header.html',
  styleUrl: './public-header.css',
})
export class PublicHeaderComponent {
  private readonly settingsApi = inject(SiteSettingsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  protected readonly portal = inject(PortalIdentityStore);

  protected readonly fallbackLogo = '/assets/brand/logo-compagnie-des-routes-oubliees.png?v=12fa08d';
  protected readonly logoutUrl = '/cdn-cgi/access/logout';
  protected readonly profileMenuOpen = signal(false);
  protected readonly profileName = computed(() => {
    const identity = this.portal.identity();
    if (identity?.displayName) {
      return identity.displayName;
    }
    if (this.portal.loading()) {
      return 'Portail';
    }
    return 'Choix requis';
  });
  protected readonly profileLabel = computed(() => `Menu du profil ${this.profileName()}`);
  protected readonly profileInitials = computed(() => this.initials(this.profileName()));
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

  @HostListener('document:keydown.escape')
  protected closeProfileMenu(): void {
    this.profileMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  protected closeProfileMenuOnOutsideClick(event: MouseEvent): void {
    if (!this.profileMenuOpen()) {
      return;
    }
    if (!this.elementRef.nativeElement.contains(event.target as Node | null)) {
      this.profileMenuOpen.set(false);
    }
  }

  protected toggleProfileMenu(): void {
    this.profileMenuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.profileMenuOpen.set(false);
  }

  private initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toLocaleUpperCase('fr-FR') ?? '')
      .join('');
  }
}
