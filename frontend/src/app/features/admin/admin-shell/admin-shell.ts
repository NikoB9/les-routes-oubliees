import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

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
  AdminAdventurer,
  AdminAdventurerUpsert,
  AdminAllowedEmailUpdate,
  AdminAuditLog,
  AdminCompany,
  AdminCompanyUpdate,
  AdminDashboard,
  AdminHomeMessage,
  AdminHomeMessageUpsert,
  AdminMapMarker,
  AdminMapMarkerUpsert,
  AdminMapPreview,
  AdminMapVision,
  AdminMapVisionUpsert,
  EditorialStatus,
  HomeMessageImportance,
} from '../admin-api.models';
import { AdminApiService } from '../admin-api.service';
import { TabBarComponent } from '../../../shared/components/tab-bar/tab-bar';

@Component({
  selector: 'app-admin-shell',
  imports: [FormsModule, RouterLink, TabBarComponent],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.css',
})
export class AdminShell {
  private readonly authService = inject(AdminAuthService);
  private readonly adminApi = inject(AdminApiService);
  private readonly notebookApi = inject(NotebookApiService);
  private readonly mediaApi = inject(MediaApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly questErrorSummary = viewChild<ElementRef<HTMLElement>>('questErrorSummary');
  private readonly mapErrorSummary = viewChild<ElementRef<HTMLElement>>('mapErrorSummary');
  private readonly mediaErrorSummary = viewChild<ElementRef<HTMLElement>>('mediaErrorSummary');
  private readonly allowedEmailErrorSummary = viewChild<ElementRef<HTMLElement>>('allowedEmailErrorSummary');

  protected readonly session = signal<AdminSession | null>(null);
  protected readonly section = signal<string>('dashboard');
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
  protected readonly homeMessages = signal<AdminHomeMessage[]>([]);
  protected readonly selectedHomeMessage = signal<AdminHomeMessage | null>(null);
  protected readonly homeMessageForm = signal<AdminHomeMessageUpsert>(this.emptyHomeMessageForm());
  protected readonly homeMessageError = signal(false);
  protected readonly homeMessageSaved = signal(false);
  protected readonly homeMessageStatuses: EditorialStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
  protected readonly homeMessageImportances: HomeMessageImportance[] = [
    'INFORMATION',
    'WARNING',
    'QUEST_IMMINENT',
    'SUCCESS',
    'MYSTERY',
  ];
  protected readonly company = signal<AdminCompany | null>(null);
  protected readonly companyForm = signal<AdminCompanyUpdate>(this.emptyCompanyForm());
  protected readonly companyError = signal(false);
  protected readonly companySaved = signal(false);
  protected readonly adventurers = signal<AdminAdventurer[]>([]);
  protected readonly selectedAdventurer = signal<AdminAdventurer | null>(null);
  protected readonly adventurerForm = signal<AdminAdventurerUpsert>(this.emptyAdventurerForm());
  protected readonly adventurerError = signal(false);
  protected readonly adventurerSaved = signal(false);
  protected readonly mapVisions = signal<AdminMapVision[]>([]);
  protected readonly selectedMapVision = signal<AdminMapVision | null>(null);
  protected readonly mapVisionForm = signal<AdminMapVisionUpsert>(this.emptyMapVisionForm());
  protected readonly mapMarkers = signal<AdminMapMarker[]>([]);
  protected readonly selectedMapMarker = signal<AdminMapMarker | null>(null);
  protected readonly mapMarkerForm = signal<AdminMapMarkerUpsert>(this.emptyMapMarkerForm());
  protected readonly mapPreview = signal<AdminMapPreview | null>(null);
  protected readonly mapError = signal(false);
  protected readonly mapSaved = signal(false);
  protected readonly mapStatuses: EditorialStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
  protected readonly questCodes = ['QUEST_1', 'QUEST_2', 'QUEST_3', 'QUEST_4', 'VAL_D_AURELUNE'];
  protected readonly allowedEmails = signal<AdminAllowedEmail[]>([]);
  protected readonly allowedEmailError = signal(false);
  protected readonly allowedEmailSaved = signal(false);
  protected readonly allowedEmailForm = signal({ email: '', label: '' });
  protected readonly auditLogs = signal<AdminAuditLog[]>([]);
  protected readonly auditError = signal(false);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.section.set(params.get('section') ?? 'dashboard');
      if (this.session()) {
        this.loadSectionData(this.section());
      }
    });

    this.authService.currentSession().subscribe({
      next: (session) => {
        this.session.set(session);
        this.loadSectionData(this.section());
      },
      error: () => this.error.set(true),
    });
  }

  private loadSectionData(section: string) {
    switch (section) {
      case 'dashboard':
        this.loadDashboard();
        break;
      case 'home':
        this.loadHomeMessages();
        break;
      case 'group':
        this.loadCompany();
        break;
      case 'adventurers':
        this.loadAdventurers();
        break;
      case 'map':
        this.loadAdminMap();
        break;
      case 'notebook':
        this.loadQuests();
        break;
      case 'media':
        this.loadMedia();
        break;
      case 'administrators':
        this.loadAllowedEmails();
        break;
      case 'audit':
        this.loadAuditLogs();
        break;
      default:
        break;
    }
  }

  protected logout() {
    this.authService.logout().subscribe({
      next: () => void this.router.navigate(['/admin/login']),
      error: () => this.error.set(true),
    });
  }

  protected selectHomeMessage(message: AdminHomeMessage | null) {
    this.selectedHomeMessage.set(message);
    this.homeMessageSaved.set(false);
    this.homeMessageError.set(false);
    this.homeMessageForm.set(message ? this.toHomeMessageForm(message) : this.emptyHomeMessageForm());
  }

  protected updateHomeMessageField<K extends keyof AdminHomeMessageUpsert>(
    field: K,
    value: AdminHomeMessageUpsert[K],
  ) {
    this.homeMessageForm.update((form) => ({ ...form, [field]: value }));
    this.homeMessageSaved.set(false);
    this.homeMessageError.set(false);
  }

  protected saveHomeMessage() {
    const message = this.selectedHomeMessage();
    const payload = this.normalizedHomeMessagePayload();
    const request = message
      ? this.adminApi.updateHomeMessage(message.id, payload)
      : this.adminApi.createHomeMessage(payload);

    request.subscribe({
      next: (saved) => {
        this.upsertHomeMessage(saved);
        this.selectHomeMessage(saved);
        this.homeMessageSaved.set(true);
        this.loadDashboard();
        this.loadAuditLogs();
      },
      error: () => this.homeMessageError.set(true),
    });
  }

  protected activateHomeMessage(message: AdminHomeMessage) {
    this.adminApi.activateHomeMessage(message.id).subscribe({
      next: (updated) => {
        this.homeMessages.update((messages) =>
          messages.map((item) => ({ ...item, active: item.id === updated.id })),
        );
        this.upsertHomeMessage(updated);
        this.selectHomeMessage(updated);
        this.homeMessageSaved.set(true);
        this.loadDashboard();
        this.loadAuditLogs();
      },
      error: () => this.homeMessageError.set(true),
    });
  }

  protected deleteHomeMessage(message: AdminHomeMessage) {
    this.adminApi.deleteHomeMessage(message.id).subscribe({
      next: () => {
        this.homeMessages.update((messages) => messages.filter((item) => item.id !== message.id));
        if (this.selectedHomeMessage()?.id === message.id) {
          this.selectHomeMessage(null);
        }
        this.homeMessageSaved.set(true);
        this.loadDashboard();
        this.loadAuditLogs();
      },
      error: () => this.homeMessageError.set(true),
    });
  }

  protected updateCompanyField<K extends keyof AdminCompanyUpdate>(
    field: K,
    value: AdminCompanyUpdate[K],
  ) {
    this.companyForm.update((form) => ({ ...form, [field]: value }));
    this.companySaved.set(false);
    this.companyError.set(false);
  }

  protected saveCompany() {
    const payload = this.normalizedCompanyPayload();
    this.adminApi.updateCompany(payload).subscribe({
      next: (company) => {
        this.company.set(company);
        this.companyForm.set(this.toCompanyForm(company));
        this.companySaved.set(true);
        this.companyError.set(false);
        this.loadDashboard();
        this.loadAuditLogs();
      },
      error: () => this.companyError.set(true),
    });
  }

  protected selectAdventurer(adventurer: AdminAdventurer | null) {
    this.selectedAdventurer.set(adventurer);
    this.adventurerSaved.set(false);
    this.adventurerError.set(false);
    this.adventurerForm.set(adventurer ? this.toAdventurerForm(adventurer) : this.emptyAdventurerForm());
  }

  protected updateAdventurerField<K extends keyof AdminAdventurerUpsert>(
    field: K,
    value: AdminAdventurerUpsert[K],
  ) {
    this.adventurerForm.update((form) => ({ ...form, [field]: value }));
    this.adventurerSaved.set(false);
    this.adventurerError.set(false);
  }

  protected saveAdventurer() {
    const adventurer = this.selectedAdventurer();
    const payload = this.normalizedAdventurerPayload();
    const request = adventurer
      ? this.adminApi.updateAdventurer(adventurer.id, payload)
      : this.adminApi.createAdventurer(payload);

    request.subscribe({
      next: (saved) => {
        this.upsertAdventurer(saved);
        this.selectAdventurer(saved);
        this.adventurerSaved.set(true);
        this.loadDashboard();
        this.loadAuditLogs();
      },
      error: () => this.adventurerError.set(true),
    });
  }

  protected moveAdventurer(adventurer: AdminAdventurer, direction: -1 | 1) {
    const current = this.adventurers();
    const index = current.findIndex((item) => item.id === adventurer.id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= current.length) {
      return;
    }
    const reordered = [...current];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    this.adminApi.reorderAdventurers(reordered.map((item) => item.id)).subscribe({
      next: (updated) => {
        this.adventurers.set(updated);
        this.adventurerSaved.set(true);
        this.loadAuditLogs();
      },
      error: () => this.adventurerError.set(true),
    });
  }

  protected deleteAdventurer(adventurer: AdminAdventurer) {
    this.adminApi.deleteAdventurer(adventurer.id).subscribe({
      next: () => {
        this.adventurers.update((items) => items.filter((item) => item.id !== adventurer.id));
        if (this.selectedAdventurer()?.id === adventurer.id) {
          this.selectAdventurer(null);
        }
        this.adventurerSaved.set(true);
        this.loadDashboard();
        this.loadAuditLogs();
      },
      error: () => this.adventurerError.set(true),
    });
  }

  protected selectMapVision(vision: AdminMapVision | null) {
    this.selectedMapVision.set(vision);
    this.mapPreview.set(null);
    this.mapSaved.set(false);
    this.mapError.set(false);
    this.mapVisionForm.set(vision ? this.toMapVisionForm(vision) : this.emptyMapVisionForm());
  }

  protected updateMapVisionField<K extends keyof AdminMapVisionUpsert>(
    field: K,
    value: AdminMapVisionUpsert[K],
  ) {
    this.mapVisionForm.update((form) => ({ ...form, [field]: value }));
    this.mapSaved.set(false);
    this.mapError.set(false);
  }

  protected saveMapVision() {
    const vision = this.selectedMapVision();
    const payload = this.normalizedMapVisionPayload();
    const request = vision
      ? this.adminApi.updateMapVision(vision.id, payload)
      : this.adminApi.createMapVision(payload);

    request.subscribe({
      next: (saved) => {
        this.upsertMapVision(saved);
        this.selectMapVision(saved);
        this.mapSaved.set(true);
        this.loadDashboard();
        this.loadAuditLogs();
      },
      error: () => this.showMapError(),
    });
  }

  protected activateMapVision(vision: AdminMapVision) {
    this.adminApi.activateMapVision(vision.id).subscribe({
      next: (updated) => {
        this.mapVisions.update((visions) =>
          visions.map((item) => ({ ...item, active: item.id === updated.id })),
        );
        this.upsertMapVision(updated);
        this.selectMapVision(updated);
        this.mapSaved.set(true);
        this.loadDashboard();
        this.loadAuditLogs();
      },
      error: () => this.showMapError(),
    });
  }

  protected deleteMapVision(vision: AdminMapVision) {
    this.adminApi.deleteMapVision(vision.id).subscribe({
      next: () => {
        this.mapVisions.update((visions) => visions.filter((item) => item.id !== vision.id));
        if (this.selectedMapVision()?.id === vision.id) {
          this.selectMapVision(null);
        }
        this.mapSaved.set(true);
        this.loadDashboard();
        this.loadAuditLogs();
      },
      error: () => this.showMapError(),
    });
  }

  protected previewMapVision(vision: AdminMapVision) {
    this.adminApi.previewMap(vision.id).subscribe({
      next: (preview) => {
        this.mapPreview.set(preview);
        this.mapError.set(false);
      },
      error: () => this.showMapError(),
    });
  }

  protected selectMapMarker(marker: AdminMapMarker | null) {
    this.selectedMapMarker.set(marker);
    this.mapSaved.set(false);
    this.mapError.set(false);
    this.mapMarkerForm.set(marker ? this.toMapMarkerForm(marker) : this.emptyMapMarkerForm());
  }

  protected updateMapMarkerField<K extends keyof AdminMapMarkerUpsert>(
    field: K,
    value: AdminMapMarkerUpsert[K],
  ) {
    this.mapMarkerForm.update((form) => ({ ...form, [field]: value }));
    this.mapSaved.set(false);
    this.mapError.set(false);
  }

  protected saveMapMarker() {
    const marker = this.selectedMapMarker();
    const payload = this.normalizedMapMarkerPayload();
    const request = marker
      ? this.adminApi.updateMapMarker(marker.id, payload)
      : this.adminApi.createMapMarker(payload);

    request.subscribe({
      next: (saved) => {
        this.upsertMapMarker(saved);
        this.selectMapMarker(saved);
        this.mapSaved.set(true);
        this.loadAuditLogs();
      },
      error: () => this.showMapError(),
    });
  }

  protected deleteMapMarker(marker: AdminMapMarker) {
    this.adminApi.deleteMapMarker(marker.id).subscribe({
      next: () => {
        this.mapMarkers.update((markers) => markers.filter((item) => item.id !== marker.id));
        if (this.selectedMapMarker()?.id === marker.id) {
          this.selectMapMarker(null);
        }
        this.mapSaved.set(true);
        this.loadAuditLogs();
      },
      error: () => this.showMapError(),
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

  private loadHomeMessages() {
    this.adminApi.listHomeMessages().subscribe({
      next: (messages) => {
        this.homeMessages.set(messages);
        this.selectHomeMessage(messages[0] ?? null);
        this.homeMessageError.set(false);
      },
      error: () => this.homeMessageError.set(true),
    });
  }

  private loadCompany() {
    this.adminApi.getCompany().subscribe({
      next: (company) => {
        this.company.set(company);
        this.companyForm.set(this.toCompanyForm(company));
        this.companyError.set(false);
      },
      error: () => this.companyError.set(true),
    });
  }

  private loadAdventurers() {
    this.adminApi.listAdventurers().subscribe({
      next: (adventurers) => {
        this.adventurers.set(adventurers);
        this.selectAdventurer(adventurers[0] ?? null);
        this.adventurerError.set(false);
      },
      error: () => this.adventurerError.set(true),
    });
  }

  private loadAdminMap() {
    this.adminApi.listMapVisions().subscribe({
      next: (visions) => {
        this.mapVisions.set(visions);
        this.selectMapVision(visions.find((vision) => vision.active) ?? visions[0] ?? null);
      },
      error: () => this.showMapError(),
    });
    this.adminApi.listMapMarkers().subscribe({
      next: (markers) => {
        this.mapMarkers.set(markers);
        this.selectMapMarker(markers[0] ?? null);
      },
      error: () => this.showMapError(),
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

  private upsertHomeMessage(saved: AdminHomeMessage) {
    this.homeMessages.update((messages) => {
      const exists = messages.some((message) => message.id === saved.id);
      if (exists) {
        return messages.map((message) => (message.id === saved.id ? saved : message));
      }
      return [saved, ...messages];
    });
  }

  private emptyHomeMessageForm(): AdminHomeMessageUpsert {
    return {
      title: '',
      contentMarkdown: '',
      importance: 'INFORMATION',
      status: 'DRAFT',
      countdownEnabled: false,
      endsAt: null,
      expiredMessage: null,
    };
  }

  private toHomeMessageForm(message: AdminHomeMessage): AdminHomeMessageUpsert {
    return {
      title: message.title,
      contentMarkdown: message.contentMarkdown,
      importance: message.importance,
      status: message.status,
      countdownEnabled: message.countdownEnabled,
      endsAt: message.endsAt,
      expiredMessage: message.expiredMessage,
    };
  }

  private normalizedHomeMessagePayload(): AdminHomeMessageUpsert {
    const form = this.homeMessageForm();
    return {
      ...form,
      title: form.title.trim(),
      contentMarkdown: form.contentMarkdown.trim(),
      endsAt: form.countdownEnabled ? form.endsAt : null,
      expiredMessage: this.trimToNull(form.expiredMessage),
    };
  }

  private emptyCompanyForm(): AdminCompanyUpdate {
    return {
      name: '',
      emblemPath: null,
      imageAlt: null,
      shortDescription: '',
      longDescriptionMarkdown: '',
    };
  }

  private toCompanyForm(company: AdminCompany): AdminCompanyUpdate {
    return {
      name: company.name,
      emblemPath: company.emblemPath,
      imageAlt: company.imageAlt,
      shortDescription: company.shortDescription,
      longDescriptionMarkdown: company.longDescriptionMarkdown,
    };
  }

  private normalizedCompanyPayload(): AdminCompanyUpdate {
    const form = this.companyForm();
    return {
      name: form.name.trim(),
      emblemPath: this.trimToNull(form.emblemPath),
      imageAlt: this.trimToNull(form.imageAlt),
      shortDescription: form.shortDescription.trim(),
      longDescriptionMarkdown: form.longDescriptionMarkdown.trim(),
    };
  }

  private upsertAdventurer(saved: AdminAdventurer) {
    this.adventurers.update((adventurers) => {
      const exists = adventurers.some((adventurer) => adventurer.id === saved.id);
      const updated = exists
        ? adventurers.map((adventurer) => (adventurer.id === saved.id ? saved : adventurer))
        : [...adventurers, saved];
      return updated.sort((left, right) => left.displayOrder - right.displayOrder);
    });
  }

  private emptyAdventurerForm(): AdminAdventurerUpsert {
    return {
      name: '',
      title: '',
      avatarPath: null,
      avatarAlt: null,
      shortDescription: '',
      strengths: '',
      weaknesses: '',
      visible: true,
      displayOrder: this.adventurers().length + 1,
    };
  }

  private toAdventurerForm(adventurer: AdminAdventurer): AdminAdventurerUpsert {
    return {
      name: adventurer.name,
      title: adventurer.title,
      avatarPath: adventurer.avatarPath,
      avatarAlt: adventurer.avatarAlt,
      shortDescription: adventurer.shortDescription,
      strengths: adventurer.strengths,
      weaknesses: adventurer.weaknesses,
      visible: adventurer.visible,
      displayOrder: adventurer.displayOrder,
    };
  }

  private normalizedAdventurerPayload(): AdminAdventurerUpsert {
    const form = this.adventurerForm();
    return {
      name: form.name.trim(),
      title: form.title.trim(),
      avatarPath: this.trimToNull(form.avatarPath),
      avatarAlt: this.trimToNull(form.avatarAlt),
      shortDescription: form.shortDescription.trim(),
      strengths: form.strengths.trim(),
      weaknesses: form.weaknesses.trim(),
      visible: form.visible,
      displayOrder: Number(form.displayOrder),
    };
  }

  private emptyMapVisionForm(): AdminMapVisionUpsert {
    return {
      name: '',
      descriptionMarkdown: '',
      assetPath: '/assets/maps/map-hidden.png',
      imageAlt: '',
      displayOrder: this.mapVisions().length + 1,
      status: 'DRAFT',
    };
  }

  private toMapVisionForm(vision: AdminMapVision): AdminMapVisionUpsert {
    return {
      name: vision.name,
      descriptionMarkdown: vision.descriptionMarkdown,
      assetPath: vision.assetPath,
      imageAlt: vision.imageAlt,
      displayOrder: vision.displayOrder,
      status: vision.status,
    };
  }

  private normalizedMapVisionPayload(): AdminMapVisionUpsert {
    const form = this.mapVisionForm();
    return {
      name: form.name.trim(),
      descriptionMarkdown: form.descriptionMarkdown.trim(),
      assetPath: form.assetPath.trim(),
      imageAlt: form.imageAlt.trim(),
      displayOrder: Number(form.displayOrder),
      status: form.status,
    };
  }

  private upsertMapVision(saved: AdminMapVision) {
    this.mapVisions.update((visions) => {
      const exists = visions.some((vision) => vision.id === saved.id);
      const updated = exists
        ? visions.map((vision) => (vision.id === saved.id ? saved : vision))
        : [...visions, saved];
      return updated.sort((left, right) => left.displayOrder - right.displayOrder);
    });
  }

  private emptyMapMarkerForm(): AdminMapMarkerUpsert {
    return {
      questCode: 'QUEST_1',
      title: '',
      positionX: 50,
      positionY: 50,
      active: true,
      displayOrder: this.mapMarkers().length + 1,
    };
  }

  private toMapMarkerForm(marker: AdminMapMarker): AdminMapMarkerUpsert {
    return {
      questCode: marker.questCode,
      title: marker.title,
      positionX: marker.positionX,
      positionY: marker.positionY,
      active: marker.active,
      displayOrder: marker.displayOrder,
    };
  }

  private normalizedMapMarkerPayload(): AdminMapMarkerUpsert {
    const form = this.mapMarkerForm();
    return {
      questCode: form.questCode,
      title: form.title.trim(),
      positionX: Number(form.positionX),
      positionY: Number(form.positionY),
      active: form.active,
      displayOrder: Number(form.displayOrder),
    };
  }

  private upsertMapMarker(saved: AdminMapMarker) {
    this.mapMarkers.update((markers) => {
      const exists = markers.some((marker) => marker.id === saved.id);
      const updated = exists
        ? markers.map((marker) => (marker.id === saved.id ? saved : marker))
        : [...markers, saved];
      return updated.sort((left, right) => left.displayOrder - right.displayOrder);
    });
  }

  private trimToNull(value: string | null): string | null {
    if (!value || !value.trim()) {
      return null;
    }
    return value.trim();
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

  private showMapError() {
    this.mapError.set(true);
    this.focusSummary(this.mapErrorSummary());
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
