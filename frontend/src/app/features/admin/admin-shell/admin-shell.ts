import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AdminAuthService } from '../../../core/auth/admin-auth.service';
import { AdminSession } from '../../../core/auth/admin-session';
import {
  AdminQuest,
  AdminQuestUpdate,
  QuestStatus,
} from '../../notebook/notebook-api.models';
import { NotebookApiService } from '../../notebook/notebook-api.service';

@Component({
  selector: 'app-admin-shell',
  imports: [FormsModule],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.css',
})
export class AdminShell {
  private readonly authService = inject(AdminAuthService);
  private readonly notebookApi = inject(NotebookApiService);
  private readonly router = inject(Router);

  protected readonly session = signal<AdminSession | null>(null);
  protected readonly error = signal(false);
  protected readonly questError = signal(false);
  protected readonly questSaved = signal(false);
  protected readonly quests = signal<AdminQuest[]>([]);
  protected readonly selectedQuest = signal<AdminQuest | null>(null);
  protected readonly editor = signal<AdminQuestUpdate | null>(null);
  protected readonly statuses: QuestStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

  constructor() {
    this.authService.currentSession().subscribe({
      next: (session) => {
        this.session.set(session);
        this.loadQuests();
      },
      error: () => this.error.set(true),
    });
  }

  protected logout() {
    this.authService.logout().subscribe({
      next: () => void this.router.navigate(['/admin/login']),
      error: () => this.error.set(true),
    });
  }

  protected selectQuest(code: string) {
    this.questSaved.set(false);
    this.questError.set(false);
    this.notebookApi.getAdminQuest(code).subscribe({
      next: (quest) => this.setSelectedQuest(quest),
      error: () => this.questError.set(true),
    });
  }

  protected updateField<K extends keyof AdminQuestUpdate>(field: K, value: AdminQuestUpdate[K]) {
    const current = this.editor();
    if (!current) {
      return;
    }
    this.editor.set({ ...current, [field]: value });
  }

  protected updateStatus(value: string) {
    if (this.statuses.includes(value as QuestStatus)) {
      this.updateField('status', value as QuestStatus);
    }
  }

  protected saveQuest() {
    const quest = this.selectedQuest();
    const payload = this.editor();
    if (!quest || !payload) {
      return;
    }

    this.notebookApi.updateAdminQuest(quest.code, payload).subscribe({
      next: (updated) => {
        this.replaceQuest(updated);
        this.setSelectedQuest(updated);
        this.questSaved.set(true);
      },
      error: () => this.questError.set(true),
    });
  }

  protected publishQuest() {
    const quest = this.selectedQuest();
    if (!quest) {
      return;
    }
    this.notebookApi.publishAdminQuest(quest.code, true).subscribe({
      next: (updated) => {
        this.replaceQuest(updated);
        this.setSelectedQuest(updated);
        this.questSaved.set(true);
      },
      error: () => this.questError.set(true),
    });
  }

  protected hideQuest() {
    const quest = this.selectedQuest();
    if (!quest) {
      return;
    }
    this.notebookApi.hideAdminQuest(quest.code).subscribe({
      next: (updated) => {
        this.replaceQuest(updated);
        this.setSelectedQuest(updated);
        this.questSaved.set(true);
      },
      error: () => this.questError.set(true),
    });
  }

  protected archiveQuest() {
    const quest = this.selectedQuest();
    if (!quest) {
      return;
    }
    this.notebookApi.archiveAdminQuest(quest.code).subscribe({
      next: (updated) => {
        this.replaceQuest(updated);
        this.setSelectedQuest(updated);
        this.questSaved.set(true);
      },
      error: () => this.questError.set(true),
    });
  }

  private loadQuests() {
    this.notebookApi.listAdminQuests().subscribe({
      next: (quests) => {
        this.quests.set(quests);
        if (quests[0]) {
          this.setSelectedQuest(quests[0]);
        }
      },
      error: () => this.questError.set(true),
    });
  }

  private setSelectedQuest(quest: AdminQuest) {
    this.selectedQuest.set(quest);
    this.editor.set({
      title: quest.title,
      summary: quest.summary,
      importantEventsMarkdown: quest.importantEventsMarkdown,
      discoveredCluesMarkdown: quest.discoveredCluesMarkdown,
      completedTrialsMarkdown: quest.completedTrialsMarkdown,
      extraContentMarkdown: quest.extraContentMarkdown,
      adminDraftMarkdown: quest.adminDraftMarkdown,
      status: quest.status,
      visibleToPlayers: quest.visibleToPlayers,
    });
  }

  private replaceQuest(updated: AdminQuest) {
    this.quests.update((quests) =>
      quests.map((quest) => (quest.code === updated.code ? updated : quest)),
    );
  }
}
