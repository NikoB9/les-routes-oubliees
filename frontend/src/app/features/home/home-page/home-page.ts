import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { parseSafeMarkdown } from '../../../shared/utilities/safe-markdown';
import { LoadingIndicatorComponent } from '../../../shared/components/loading-indicator/loading-indicator';
import { HomeMessageImportance, PublicHomeResponse } from '../home-api.models';
import { HomeApiService } from '../home-api.service';

interface CountdownView {
  expired: boolean;
  label: string;
}

@Component({
  selector: 'app-home-page',
  imports: [LoadingIndicatorComponent],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
})
export class HomePage {
  private readonly api = inject(HomeApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly home = signal<PublicHomeResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly now = signal(new Date());

  protected readonly activeMessage = computed(() => this.home()?.message ?? null);
  protected readonly company = computed(() => this.home()?.company ?? null);
  protected readonly adventurers = computed(() => this.home()?.adventurers ?? []);
  protected readonly messageBlocks = computed(() =>
    parseSafeMarkdown(this.activeMessage()?.contentMarkdown),
  );
  protected readonly companyBlocks = computed(() =>
    parseSafeMarkdown(this.company()?.longDescriptionMarkdown),
  );
  protected readonly countdown = computed<CountdownView | null>(() => {
    const message = this.activeMessage();

    if (!message?.countdownEnabled || !message.endsAt) {
      return null;
    }

    const remainingMs = new Date(message.endsAt).getTime() - this.now().getTime();

    if (Number.isNaN(remainingMs) || remainingMs <= 0) {
      return {
        expired: true,
        label: 'Échéance atteinte',
      };
    }

    return {
      expired: false,
      label: this.formatDuration(remainingMs),
    };
  });

  protected readonly importanceLabel: Record<HomeMessageImportance, string> = {
    INFORMATION: 'Information',
    WARNING: 'Avertissement',
    QUEST_IMMINENT: 'Quête imminente',
    SUCCESS: 'Réussite',
    MYSTERY: 'Mystère',
  };

  constructor() {
    this.api
      .getHome()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (home) => {
          this.home.set(home);
          this.loading.set(false);
          this.loadError.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadError.set(true);
        },
      });

    const timer = window.setInterval(() => this.now.set(new Date()), 1000);
    this.destroyRef.onDestroy(() => window.clearInterval(timer));
  }

  protected formatExactDate(value: string | null, timezone: string | null | undefined): string {
    if (!value) {
      return '';
    }

    try {
      return new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone: timezone || 'Europe/Paris',
      }).format(new Date(value));
    } catch {
      return new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'full',
        timeStyle: 'short',
      }).format(new Date(value));
    }
  }

  protected traits(value: string): string[] {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private formatDuration(milliseconds: number): string {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor((totalSeconds % 86_400) / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;
    const parts: string[] = [];

    if (days > 0) {
      parts.push(`${days} j`);
    }
    parts.push(`${hours.toString().padStart(2, '0')} h`);
    parts.push(`${minutes.toString().padStart(2, '0')} min`);
    parts.push(`${seconds.toString().padStart(2, '0')} s`);

    return parts.join(' ');
  }
}
