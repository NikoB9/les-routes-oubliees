import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { NotebookApiService } from '../notebook-api.service';
import { PublicQuestDetail, PublicQuestSummary } from '../notebook-api.models';
import { TabBarComponent } from '../../../shared/components/tab-bar/tab-bar';

@Component({
  selector: 'app-notebook-page',
  imports: [RouterLink, TabBarComponent],
  templateUrl: './notebook-page.html',
  styleUrl: './notebook-page.css',
})
export class NotebookPage {
  private readonly api = inject(NotebookApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly quests = signal<PublicQuestSummary[]>([]);
  protected readonly selectedQuest = signal<PublicQuestDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly selectedCode = signal<string | null>(null);
  protected readonly hasQuests = computed(() => this.quests().length > 0);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.selectedCode.set(params.get('questCode'));
      this.loadNotebook();
    });
  }

  protected sections(quest: PublicQuestDetail) {
    return [
      { title: 'Evenements importants', html: quest.importantEventsHtml },
      { title: 'Indices decouverts', html: quest.discoveredCluesHtml },
      { title: 'Epreuves realisees', html: quest.completedTrialsHtml },
      { title: 'Notes complementaires', html: quest.extraContentHtml },
    ];
  }

  private loadNotebook() {
    this.loading.set(true);
    this.loadError.set(false);

    this.api
      .listPublicQuests()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (quests) => {
          this.quests.set(quests);
          const code = this.selectedCode() ?? quests[0]?.code ?? null;
          if (!code) {
            this.selectedQuest.set(null);
            this.loading.set(false);
            return;
          }
          this.loadQuest(code);
        },
        error: () => {
          this.loading.set(false);
          this.loadError.set(true);
        },
      });
  }

  private loadQuest(code: string) {
    this.api
      .getPublicQuest(code)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (quest) => {
          this.selectedQuest.set(quest);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadError.set(true);
        },
      });
  }
}
