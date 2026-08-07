import { Component, DestroyRef, ElementRef, HostListener, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { CLOUDFLARE_ACCESS_LOGOUT_URL } from '../../core/api/cloudflare-access-session.service';
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
  protected readonly portal = inject(PortalIdentityStore);

  private readonly profileMenu = viewChild<ElementRef<HTMLElement>>('profileMenu');
  private readonly profileButton = viewChild<ElementRef<HTMLButtonElement>>('profileButton');

  protected readonly fallbackLogo = '/assets/brand/logo-compagnie-des-routes-oubliees.png?v=12fa08d';
  protected readonly logoutUrl = CLOUDFLARE_ACCESS_LOGOUT_URL;
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

  /** `Escape` ferme le panneau et restitue le focus au bouton de profil. */
  @HostListener('document:keydown.escape')
  protected closeProfileMenuWithEscape(): void {
    if (!this.profileMenuOpen()) {
      return;
    }
    this.closeProfileMenu();
    this.profileButton()?.nativeElement.focus();
  }

  /**
   * Un clic réellement extérieur au panneau ferme celui-ci.
   *
   * La zone de référence est le conteneur du profil, pas l'en-tête entier : un clic sur le
   * logo est donc extérieur et ferme le panneau.
   */
  @HostListener('document:click', ['$event'])
  protected closeProfileMenuOnOutsideClick(event: MouseEvent): void {
    if (!this.profileMenuOpen()) {
      return;
    }
    const container = this.profileMenu()?.nativeElement;
    if (!container || !container.contains(event.target as Node | null)) {
      this.closeProfileMenu();
    }
  }

  protected toggleProfileMenu(): void {
    this.profileMenuOpen.update((open) => !open);
  }

  protected closeProfileMenu(): void {
    this.profileMenuOpen.set(false);
  }

  /** La déconnexion est une action : Cloudflare Access termine la session. */
  protected logout(): void {
    this.closeProfileMenu();
    window.location.assign(this.logoutUrl);
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
