import { Component, DestroyRef, ElementRef, HostListener, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';

import { CloudflareAccessSessionService } from '../../core/api/cloudflare-access-session.service';
import { SiteSettingsApiService } from '../../core/config/site-settings-api.service';
import { PublicSiteSettings } from '../../core/config/site-settings.models';
import { PortalIdentityStore } from '../../core/portal/portal-identity.store';

/**
 * Ce que l'en-tête présente à droite du bandeau.
 *
 * Les cinq cas sont exclusifs, et leur ordre d'évaluation compte : lorsque la session Access
 * expire, l'identité est absente *et* le portail en erreur. Proposer « Se déconnecter » à
 * quelqu'un qui ne l'est plus était précisément le défaut à corriger.
 */
export type HeaderProfileMode = 'offline' | 'expired' | 'identified' | 'loading' | 'unavailable';

@Component({
  selector: 'app-public-header',
  imports: [RouterLink],
  templateUrl: './public-header.html',
  styleUrl: './public-header.css',
})
export class PublicHeaderComponent {
  private readonly settingsApi = inject(SiteSettingsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  protected readonly portal = inject(PortalIdentityStore);
  protected readonly accessSession = inject(CloudflareAccessSessionService);

  private readonly profileMenu = viewChild<ElementRef<HTMLElement>>('profileMenu');
  private readonly profileButton = viewChild<ElementRef<HTMLButtonElement>>('profileButton');

  /**
   * `navigator.onLine` ne prouve rien quand il vaut `true`, mais il est fiable quand il vaut
   * `false`. Il ne sert donc qu'à *retirer* le lien de reprise, jamais à l'offrir : le suivre
   * sans réseau emmènerait sur une adresse volontairement exclue du cache, donc sur la page
   * d'erreur du navigateur, en perdant l'application ouverte.
   */
  private readonly online = signal(navigator.onLine);
  private readonly currentUrl = signal(this.router.url);

  protected readonly fallbackLogo = '/assets/brand/logo-compagnie-des-routes-oubliees.png?v=12fa08d';
  protected readonly logoutUrl = '/cdn-cgi/access/logout';

  protected readonly mode = computed<HeaderProfileMode>(() => {
    // L'expiration prime sur l'identité : celle-ci reste en mémoire après la perte de session,
    // et c'est elle qui faisait proposer « Se déconnecter » à quelqu'un qui ne l'était plus.
    if (this.accessSession.sessionExpired()) {
      return this.online() ? 'expired' : 'offline';
    }
    // Sans réseau, une identité déjà chargée reste vraie : la masquer priverait l'aventurier de
    // son nom et de l'accès administration sans rien apporter.
    if (this.portal.identity()) {
      return 'identified';
    }
    if (this.portal.loading()) {
      return 'loading';
    }
    return this.online() ? 'unavailable' : 'offline';
  });

  /** Adresse de reprise, portant la page consultée pour y revenir après authentification. */
  protected readonly reconnectHref = computed(() =>
    this.accessSession.reconnectHref(this.currentUrl()),
  );

  protected readonly profileMenuOpen = signal(false);

  /**
   * Le panneau ne peut être ouvert qu'à l'état identifié.
   *
   * Le dériver plutôt que de le corriger par un effet garantit qu'une expiration survenue
   * panneau ouvert ne laisse pas « Se déconnecter » à l'écran, sans écriture de signal ailleurs.
   */
  protected readonly profilePanelOpen = computed(
    () => this.profileMenuOpen() && this.mode() === 'identified',
  );

  /** `displayName` est nul tant que l'aventurier n'a pas choisi son reflet. */
  protected readonly profileName = computed(
    () => this.portal.identity()?.displayName || 'Choix requis',
  );
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

    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.currentUrl.set(event.urlAfterRedirects);
      }
    });
  }

  @HostListener('window:online')
  protected noteOnline(): void {
    this.online.set(true);
  }

  @HostListener('window:offline')
  protected noteOffline(): void {
    this.online.set(false);
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
