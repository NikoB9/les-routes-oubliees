import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

const DISMISSED_AT_KEY = 'lro-pwa-install-dismissed-at';
const DISMISS_DELAY_MS = 1000 * 60 * 60 * 24 * 14;

@Injectable({ providedIn: 'root' })
export class PwaInstallPromptService {
  private readonly document = inject(DOCUMENT);
  private readonly installPrompt = signal<BeforeInstallPromptEvent | null>(null);
  private readonly dismissed = signal(this.isRecentlyDismissed());

  readonly canInstall = computed(() => this.installPrompt() !== null && !this.dismissed());
  readonly showIosHelp = computed(() => this.isIosSafari() && !this.isStandalone() && !this.dismissed());

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.installPrompt.set(event as BeforeInstallPromptEvent);
    });

    window.addEventListener('appinstalled', () => {
      this.installPrompt.set(null);
      this.dismiss();
    });
  }

  async install(): Promise<void> {
    const prompt = this.installPrompt();

    if (!prompt) {
      return;
    }

    await prompt.prompt();
    const choice = await prompt.userChoice;
    this.installPrompt.set(null);

    if (choice.outcome === 'dismissed') {
      this.dismiss();
    }
  }

  dismiss(): void {
    this.dismissed.set(true);
    try {
      localStorage.setItem(DISMISSED_AT_KEY, Date.now().toString());
    } catch {
      // Storage can be unavailable in private browsing.
    }
  }

  private isRecentlyDismissed(): boolean {
    try {
      const value = localStorage.getItem(DISMISSED_AT_KEY);
      if (!value) {
        return false;
      }
      return Date.now() - Number(value) < DISMISS_DELAY_MS;
    } catch {
      return false;
    }
  }

  private isIosSafari(): boolean {
    if (typeof navigator === 'undefined') {
      return false;
    }

    const userAgent = navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(userAgent) || (userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS/.test(userAgent);
    return isIos && isSafari;
  }

  private isStandalone(): boolean {
    const navigatorStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;
    return (
      this.document.defaultView?.matchMedia('(display-mode: standalone)').matches === true ||
      navigatorStandalone === true
    );
  }
}
