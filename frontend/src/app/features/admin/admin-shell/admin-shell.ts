import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AdminAuthService } from '../../../core/auth/admin-auth.service';
import { AdminSession } from '../../../core/auth/admin-session';
import {
  AdminQuest,
  AdminQuestUpdate,
  QuestStatus,
} from '../../notebook/notebook-api.models';
import { NotebookApiService } from '../../notebook/notebook-api.service';
import { AdminMedia } from '../media-api.models';
import { MediaApiService } from '../media-api.service';
import {
  AdminAllowedEmail,
  AdminAllowedEmailUpdate,
  AdminAuditLog,
  AdminDashboard,
} from '../admin-api.models';
import { AdminApiService } from '../admin-api.service';

@Component({
  selector: 'app-admin-shell',
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.css',
})
export class AdminShell {
  private readonly authService = inject(AdminAuthService);
  private readonly adminApi = inject(AdminApiService);
  private readonly notebookApi = inject(NotebookApiService);
  private readonly mediaApi = inject(MediaApiService);
  private readonly router = inject(Router);
  private readonly questErrorSummary = viewChild<ElementRef<HTMLElement>>('questErrorSummary');
  private readonly mediaErrorSummary = viewChild<ElementRef<HTMLElement>>('mediaErrorSummary');
  private readonly allowedEmailErrorSummary = viewChild<ElementRef<HTMLElement>>('allowedEmailErrorSummary');

  protected readonly session = signal<AdminSession | null>(null);
  protected readonly error = signal(false);
  protected readonly questError = signal(false);
  protected readonly questSaved = signal(false);
  protected readonly quests = signal<AdminQuest[]>([]);
  protected readonly selectedQuest = signal<AdminQuest | null>(null);
  protected readonly editor = signal<AdminQuestUpdate | null>(null);
  protected readonly statuses: QuestStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
  protected readonly media = signal<AdminMedia[]>([]);
  protected readonly mediaError = signal(false);
  protected readonly mediaSaved = signal(false);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly mediaAltText = signal('');
  protected readonly dashboard = signal<AdminDashboard | null>(null);
  protected readonly dashboardError = signal(false);
  protected readonly allowedEmails = signal<AdminAllowedEmail[]>([]);
  protected readonly allowedEmailError = signal(false);
  protected readonly allowedEmailSaved = signal(false);
  protected readonly allowedEmailForm = signal({ email: '', label: '' });
  protected readonly auditLogs = signal<AdminAuditLog[]>([]);
  protected readonly auditError = signal(false);

  constructor() {
    this.authService.currentSession().subscribe({
      next: (session) => {
        this.session.set(session);
        this.loadDashboard();
        this.loadQuests();
        this.loadMedia();
        this.loadAllowedEmails();
        this.loadAuditLogs();
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
      error: () => this.showQuestError(),
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
        this.loadDashboard();
        this.loadAuditLogs();
      },
      error: () => this.showQuestError(),
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
        this.loadDashboard();
        this.loadAuditLogs();
      },
      error: () => this.showQuestError(),
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
        this.loadDashboard();
        this.loadAuditLogs();
      },
      error: () => this.showQuestError(),
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
        this.loadDashboard();
        this.loadAuditLogs();
      },
      error: () => this.showQuestError(),
    });
  }

  protected selectMediaFile(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.item(0) ?? null);
    this.mediaSaved.set(false);
    this.mediaError.set(false);
  }

  protected updateMediaAltText(value: string) {
    this.mediaAltText.set(value);
    this.mediaSaved.set(false);
  }

  protected updateAllowedEmailForm(field: 'email' | 'label', value: string) {
    this.allowedEmailForm.update((form) => ({ ...form, [field]: value }));
    this.allowedEmailSaved.set(false);
    this.allowedEmailError.set(false);
  }

  protected createAllowedEmail() {
    const form = this.allowedEmailForm();
    const email = form.email.trim();
    if (!email) {
      this.showAllowedEmailError();
      return;
    }
    this.adminApi
      .createAllowedEmail({
        email,
        label: form.label.trim() || null,
      })
      .subscribe({
        next: (created) => {
          this.allowedEmails.update((items) => [created, ...items]);
          this.allowedEmailForm.set({ email: '', label: '' });
          this.allowedEmailSaved.set(true);
          this.allowedEmailError.set(false);
          this.loadDashboard();
          this.loadAuditLogs();
        },
        error: () => this.showAllowedEmailError(),
      });
  }

  protected toggleAllowedEmail(allowedEmail: AdminAllowedEmail) {
    this.updateAllowedEmail(allowedEmail, {
      label: allowedEmail.label,
      active: !allowedEmail.active,
    });
  }

  protected updateAllowedEmailLabel(allowedEmail: AdminAllowedEmail, label: string) {
    this.updateAllowedEmail(allowedEmail, {
      label: label.trim() || null,
      active: allowedEmail.active,
    });
  }

  protected deleteAllowedEmail(allowedEmail: AdminAllowedEmail) {
    this.adminApi.deleteAllowedEmail(allowedEmail.id).subscribe({
      next: () => {
        this.allowedEmails.update((items) => items.filter((item) => item.id !== allowedEmail.id));
        this.allowedEmailSaved.set(true);
        this.allowedEmailError.set(false);
        this.loadDashboard();
        this.loadAuditLogs();
      },
      error: () => this.showAllowedEmailError(),
    });
  }

  protected uploadMedia() {
    const file = this.selectedFile();
    const altText = this.mediaAltText().trim();
    if (!file || !altText) {
      this.showMediaError();
      return;
    }
    this.mediaApi.uploadAdminMedia(file, altText).subscribe({
      next: (created) => {
        this.media.update((items) => [created, ...items]);
        this.selectedFile.set(null);
        this.mediaAltText.set('');
        this.mediaSaved.set(true);
        this.mediaError.set(false);
        this.loadDashboard();
        this.loadAuditLogs();
      },
      error: () => this.showMediaError(),
    });
  }

  protected deleteMedia(media: AdminMedia) {
    this.mediaApi.deleteAdminMedia(media.id).subscribe({
      next: () => {
        this.media.update((items) => items.filter((item) => item.id !== media.id));
        this.mediaSaved.set(true);
        this.mediaError.set(false);
        this.loadDashboard();
        this.loadAuditLogs();
      },
      error: () => this.showMediaError(),
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
      error: () => this.showQuestError(),
    });
  }

  private loadDashboard() {
    this.adminApi.getDashboard().subscribe({
      next: (dashboard) => {
        this.dashboard.set(dashboard);
        this.dashboardError.set(false);
      },
      error: () => this.dashboardError.set(true),
    });
  }

  private loadAllowedEmails() {
    this.adminApi.listAllowedEmails().subscribe({
      next: (allowedEmails) => {
        this.allowedEmails.set(allowedEmails);
        this.allowedEmailError.set(false);
      },
      error: () => this.showAllowedEmailError(),
    });
  }

  private loadAuditLogs() {
    this.adminApi.listAuditLogs().subscribe({
      next: (auditLogs) => {
        this.auditLogs.set(auditLogs);
        this.auditError.set(false);
      },
      error: () => this.auditError.set(true),
    });
  }

  private loadMedia() {
    this.mediaApi.listAdminMedia().subscribe({
      next: (media) => this.media.set(media),
      error: () => this.showMediaError(),
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

  private updateAllowedEmail(
    allowedEmail: AdminAllowedEmail,
    payload: AdminAllowedEmailUpdate,
  ) {
    this.adminApi.updateAllowedEmail(allowedEmail.id, payload).subscribe({
      next: (updated) => {
        this.allowedEmails.update((items) =>
          items.map((item) => (item.id === updated.id ? updated : item)),
        );
        this.allowedEmailSaved.set(true);
        this.allowedEmailError.set(false);
        this.loadDashboard();
        this.loadAuditLogs();
      },
      error: () => this.showAllowedEmailError(),
    });
  }

  private showQuestError() {
    this.questError.set(true);
    this.focusSummary(this.questErrorSummary());
  }

  private showMediaError() {
    this.mediaError.set(true);
    this.focusSummary(this.mediaErrorSummary());
  }

  private showAllowedEmailError() {
    this.allowedEmailError.set(true);
    this.focusSummary(this.allowedEmailErrorSummary());
  }

  private focusSummary(summary: ElementRef<HTMLElement> | undefined) {
    queueMicrotask(() => summary?.nativeElement.focus());
  }
}
