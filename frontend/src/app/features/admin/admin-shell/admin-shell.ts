import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AdminAuthService } from '../../../core/auth/admin-auth.service';
import { AdminSession } from '../../../core/auth/admin-session';
import {
  AdminQuest,
  AdminQuestPreview,
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
  AdminPortalAssignmentUpdate,
  AdminPortalIdentity,
  AdminRadarSettings,
  MapMarkerLabelPosition,
  AdminSiteSettings,
  AdminSiteSettingsUpdate,
  EditorialStatus,
  HomeMessageImportance,
  PortalAccessMode,
  SiteStatus,
} from '../admin-api.models';
import { AdminApiService } from '../admin-api.service';
import { TabBarComponent } from '../../../shared/components/tab-bar/tab-bar';
import { LoadingIndicatorComponent } from '../../../shared/components/loading-indicator/loading-indicator';
import {
  MarkdownCommand,
  MarkdownToolbarComponent,
} from '../../../shared/components/markdown-toolbar/markdown-toolbar';

type MarkdownImageSize = 'small' | 'medium' | 'large' | 'full';
type MarkdownTarget = 'homeMessage' | 'company' | 'mapVision' | 'quest' | 'settings';
type MarkdownField =
  | 'contentMarkdown'
  | 'longDescriptionMarkdown'
  | 'descriptionMarkdown'
  | 'importantEventsMarkdown'
  | 'discoveredCluesMarkdown'
  | 'completedTrialsMarkdown'
  | 'extraContentMarkdown'
  | 'adminDraftMarkdown'
  | 'accessibilityInformationMarkdown';

interface ActiveMarkdownField {
  target: MarkdownTarget;
  field: MarkdownField;
}

/**
 * Messages de la médiathèque.
 *
 * Un message unique servait les trois causes, et réclamait le texte alternatif quelle que
 * soit la vraie raison : devant un fichier trop lourd, l'administrateur corrigeait un champ
 * déjà valide puis échouait de nouveau, sans jamais apprendre la taille en cause.
 */
const MEDIA_ERROR_REQUIRED_FIELDS = 'Le fichier et le texte alternatif sont obligatoires.';
const MEDIA_ERROR_FILE_TOO_LARGE =
  "Le fichier est trop volumineux pour être envoyé. Choisissez une image plus légère, ou réduisez sa définition avant de la déposer.";
const MEDIA_ERROR_GENERIC = 'Impossible de traiter les médias pour le moment.';

/**
 * Messages des identités du portail.
 *
 * La liste des aventuriers propose aussi ceux qu'un autre joueur a déjà choisis : le conflit
 * est un aboutissement courant, pas un incident. Le message générique laissait croire à une
 * panne et n'indiquait pas la seule chose utile — que l'aventurier est pris.
 */
const PORTAL_GENERIC_ERROR = 'Impossible de mettre à jour les identités.';
const PORTAL_ADVENTURER_TAKEN_ERROR = 'Cet aventurier est déjà attribué à une autre identité.';

@Component({
  selector: 'app-admin-shell',
  imports: [FormsModule, LoadingIndicatorComponent, MarkdownToolbarComponent, RouterLink, TabBarComponent],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.css',
})
export class AdminShell {
  private readonly authService = inject(AdminAuthService);
  private readonly adminApi = inject(AdminApiService);
  private readonly notebookApi = inject(NotebookApiService);
  private readonly mediaApi = inject(MediaApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly questErrorSummary = viewChild<ElementRef<HTMLElement>>('questErrorSummary');
  private readonly mapErrorSummary = viewChild<ElementRef<HTMLElement>>('mapErrorSummary');
  private readonly mediaErrorSummary = viewChild<ElementRef<HTMLElement>>('mediaErrorSummary');
  private readonly allowedEmailErrorSummary = viewChild<ElementRef<HTMLElement>>('allowedEmailErrorSummary');
  private readonly settingsErrorSummary = viewChild<ElementRef<HTMLElement>>('settingsErrorSummary');
  private readonly imageSearchInput = viewChild<ElementRef<HTMLInputElement>>('imageSearchInput');
  private imageDialogTrigger: HTMLElement | null = null;

  protected readonly session = signal<AdminSession | null>(null);
  protected readonly section = signal<string>('dashboard');
  protected readonly error = signal(false);
  protected readonly questError = signal(false);
  protected readonly questSaved = signal(false);
  protected readonly quests = signal<AdminQuest[]>([]);
  protected readonly selectedQuest = signal<AdminQuest | null>(null);
  protected readonly editor = signal<AdminQuestUpdate | null>(null);
  protected readonly questPreview = signal<AdminQuestPreview | null>(null);
  protected readonly activeMarkdownField = signal<ActiveMarkdownField>({
    target: 'quest',
    field: 'importantEventsMarkdown',
  });
  protected readonly imageDialogOpen = signal(false);
  protected readonly imageSearch = signal('');
  protected readonly selectedImage = signal<AdminMedia | null>(null);
  protected readonly imageTitle = signal('');
  protected readonly imageSize = signal<MarkdownImageSize>('medium');
  protected readonly imageSizes: { value: MarkdownImageSize; label: string }[] = [
    { value: 'small', label: 'Petit' },
    { value: 'medium', label: 'Moyen' },
    { value: 'large', label: 'Grand' },
    { value: 'full', label: 'Pleine largeur' },
  ];
  protected readonly filteredMedia = computed(() => {
    const query = this.imageSearch().trim().toLocaleLowerCase('fr-FR');
    if (!query) {
      return this.media();
    }
    return this.media().filter((item) =>
      `${item.originalFilename} ${item.altText}`.toLocaleLowerCase('fr-FR').includes(query),
    );
  });
  protected readonly statuses: QuestStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
  protected readonly media = signal<AdminMedia[]>([]);
  protected readonly mediaError = signal(false);
  protected readonly mediaErrorMessage = signal(MEDIA_ERROR_GENERIC);
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
  protected readonly mapMarkerLabelPositions: { value: MapMarkerLabelPosition; label: string }[] = [
    { value: 'TOP', label: 'Haut' },
    { value: 'BOTTOM', label: 'Bas' },
    { value: 'LEFT', label: 'Gauche' },
    { value: 'RIGHT', label: 'Droite' },
  ];
  protected readonly questCodes = ['QUEST_1', 'QUEST_2', 'QUEST_3', 'QUEST_4', 'VAL_D_AURELUNE'];
  protected readonly allowedEmails = signal<AdminAllowedEmail[]>([]);
  protected readonly allowedEmailError = signal(false);
  protected readonly allowedEmailSaved = signal(false);
  protected readonly allowedEmailForm = signal({ email: '', label: '' });
  protected readonly auditLogs = signal<AdminAuditLog[]>([]);
  protected readonly auditError = signal(false);
  protected readonly settings = signal<AdminSiteSettings | null>(null);
  protected readonly settingsForm = signal<AdminSiteSettingsUpdate>(this.emptySettingsForm());
  protected readonly settingsError = signal(false);
  protected readonly settingsSaved = signal(false);
  protected readonly radarSettings = signal<AdminRadarSettings | null>(null);
  protected readonly radarError = signal(false);
  protected readonly radarSaved = signal(false);
  protected readonly portalIdentities = signal<AdminPortalIdentity[]>([]);
  protected readonly portalError = signal(false);
  protected readonly portalErrorMessage = signal(PORTAL_GENERIC_ERROR);
  protected readonly portalSaved = signal(false);
  protected readonly portalModes: PortalAccessMode[] = ['UNASSIGNED', 'ADVENTURER', 'GUEST'];
  protected readonly siteStatuses: SiteStatus[] = ['ONLINE', 'MAINTENANCE'];
  protected readonly countdownTimezone = computed(() => this.settings()?.timezone || 'Europe/Paris');

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
        this.loadSettings();
        break;
      case 'group':
        this.loadCompany();
        break;
      case 'adventurers':
        this.loadAdventurers();
        break;
      case 'map':
        this.loadAdminMap();
        this.loadMedia();
        break;
      case 'notebook':
        this.loadQuests();
        this.loadMedia();
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
      case 'settings':
        this.loadSettings();
        break;
      case 'radar':
        this.loadRadarSettings();
        break;
      case 'portal':
        this.loadPortalIdentities();
        this.loadAdventurers();
        break;
      default:
        break;
    }
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

  protected selectMapBackground(media: AdminMedia) {
    this.mapVisionForm.update((form) => ({
      ...form,
      assetPath: media.url,
      imageAlt: media.altText,
    }));
    this.mapSaved.set(false);
    this.mapError.set(false);
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
    this.questPreview.set(null);
    this.questSaved.set(false);
    this.questError.set(false);
  }

  protected focusMarkdownField(target: MarkdownTarget, field: MarkdownField) {
    if (this.markdownValue(target, field) !== null) {
      this.activeMarkdownField.set({ target, field });
    }
  }

  protected insertMarkdown(
    target: MarkdownTarget,
    field: MarkdownField,
    before: string,
    after: string,
    placeholder: string,
  ) {
    const value = this.markdownValue(target, field);
    if (value === null) {
      return;
    }
    const separator = value && !value.endsWith('\n') ? '\n' : '';
    this.setMarkdownValue(target, field, `${value}${separator}${before}${placeholder}${after}`);
    this.activeMarkdownField.set({ target, field });
  }

  protected applyMarkdownCommand(
    target: MarkdownTarget,
    field: MarkdownField,
    command: MarkdownCommand,
  ) {
    this.insertMarkdown(target, field, command.before, command.after, command.placeholder);
  }

  protected insertLink(target: MarkdownTarget, field: MarkdownField) {
    this.insertMarkdown(target, field, '[', '](/notebook/QUEST_1)', 'libelle du lien');
  }

  protected openImageDialog(target: MarkdownTarget, field: MarkdownField, event: Event) {
    this.focusMarkdownField(target, field);
    this.imageDialogTrigger = event.currentTarget as HTMLElement;
    this.imageSearch.set('');
    this.selectedImage.set(null);
    this.imageTitle.set('');
    this.imageSize.set('medium');
    this.imageDialogOpen.set(true);
    window.setTimeout(() => this.imageSearchInput()?.nativeElement.focus());
  }

  protected closeImageDialog() {
    this.imageDialogOpen.set(false);
    this.imageDialogTrigger?.focus();
    this.imageDialogTrigger = null;
  }

  protected handleImageDialogKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeImageDialog();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const dialog = event.currentTarget as HTMLElement;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.offsetParent !== null);

    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  protected updateImageSearch(value: string) {
    this.imageSearch.set(value);
  }

  protected selectImage(media: AdminMedia) {
    this.selectedImage.set(media);
    this.imageTitle.set(media.altText);
  }

  protected updateImageTitle(value: string) {
    this.imageTitle.set(value);
  }

  protected updateImageSize(value: string) {
    if (this.imageSizes.some((size) => size.value === value)) {
      this.imageSize.set(value as MarkdownImageSize);
    }
  }

  protected insertSelectedImage() {
    const media = this.selectedImage();
    if (!media) {
      return;
    }
    const alt = this.markdownImageText(media.altText || this.imageTitle() || media.originalFilename);
    const title = this.markdownImageTitle(this.imageTitle() || media.altText || media.originalFilename);
    const activeField = this.activeMarkdownField();
    this.insertMarkdown(
      activeField.target,
      activeField.field,
      '',
      '',
      `![${alt}](${media.url} "${title}"){size=${this.imageSize()}}`,
    );
    this.closeImageDialog();
  }

  private markdownValue(target: MarkdownTarget, field: MarkdownField): string | null {
    switch (target) {
      case 'homeMessage':
        return field === 'contentMarkdown' ? this.homeMessageForm().contentMarkdown : null;
      case 'company':
        return field === 'longDescriptionMarkdown' ? this.companyForm().longDescriptionMarkdown : null;
      case 'mapVision':
        return field === 'descriptionMarkdown' ? this.mapVisionForm().descriptionMarkdown : null;
      case 'settings':
        return field === 'accessibilityInformationMarkdown'
          ? this.settingsForm().accessibilityInformationMarkdown
          : null;
      case 'quest': {
        const editor = this.editor();
        if (!editor) {
          return null;
        }
        switch (field) {
          case 'importantEventsMarkdown':
            return editor.importantEventsMarkdown;
          case 'discoveredCluesMarkdown':
            return editor.discoveredCluesMarkdown;
          case 'completedTrialsMarkdown':
            return editor.completedTrialsMarkdown;
          case 'extraContentMarkdown':
            return editor.extraContentMarkdown;
          case 'adminDraftMarkdown':
            return editor.adminDraftMarkdown;
          default:
            return null;
        }
      }
      default:
        return null;
    }
  }

  private setMarkdownValue(target: MarkdownTarget, field: MarkdownField, value: string) {
    switch (target) {
      case 'homeMessage':
        if (field === 'contentMarkdown') {
          this.updateHomeMessageField('contentMarkdown', value);
        }
        break;
      case 'company':
        if (field === 'longDescriptionMarkdown') {
          this.updateCompanyField('longDescriptionMarkdown', value);
        }
        break;
      case 'mapVision':
        if (field === 'descriptionMarkdown') {
          this.updateMapVisionField('descriptionMarkdown', value);
        }
        break;
      case 'settings':
        if (field === 'accessibilityInformationMarkdown') {
          this.updateSettingsField('accessibilityInformationMarkdown', value);
        }
        break;
      case 'quest':
        switch (field) {
          case 'importantEventsMarkdown':
          case 'discoveredCluesMarkdown':
          case 'completedTrialsMarkdown':
          case 'extraContentMarkdown':
          case 'adminDraftMarkdown':
            this.updateField(field, value);
            break;
          default:
            break;
        }
        break;
      default:
        break;
    }
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

    this.notebookApi.updateAdminQuest(quest.code, this.normalizedQuestPayload(payload)).subscribe({
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

  protected previewQuest() {
    const payload = this.editor();
    if (!payload) {
      return;
    }
    this.notebookApi.previewAdminQuest(this.normalizedQuestPayload(payload)).subscribe({
      next: (preview) => {
        this.questPreview.set(preview);
        this.questError.set(false);
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
      this.showMediaError(MEDIA_ERROR_REQUIRED_FIELDS);
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
      error: (error: unknown) => this.showMediaError(this.mediaUploadErrorMessage(error)),
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

  protected updateSettingsField<K extends keyof AdminSiteSettingsUpdate>(
    field: K,
    value: AdminSiteSettingsUpdate[K],
  ) {
    this.settingsForm.update((form) => ({ ...form, [field]: value }));
    this.settingsSaved.set(false);
    this.settingsError.set(false);
  }

  protected updateSiteStatus(value: string) {
    if (this.siteStatuses.includes(value as SiteStatus)) {
      this.updateSettingsField('status', value as SiteStatus);
    }
  }

  protected saveSettings() {
    this.adminApi.updateSiteSettings(this.normalizedSettingsPayload()).subscribe({
      next: (settings) => {
        this.settings.set(settings);
        this.settingsForm.set(this.toSettingsForm(settings));
        this.settingsSaved.set(true);
        this.settingsError.set(false);
        this.loadAuditLogs();
      },
      error: () => this.showSettingsError(),
    });
  }

  protected updateTreasureVisibility(visible: boolean) {
    this.radarSaved.set(false);
    this.adminApi.updateRadarSettings(visible).subscribe({
      next: (settings) => {
        this.radarSettings.set(settings);
        this.radarSaved.set(true);
        this.radarError.set(false);
        this.loadAuditLogs();
      },
      error: () => this.radarError.set(true),
    });
  }

  /**
   * Aventuriers qu'il est permis de proposer pour une identité.
   *
   * Un aventurier masqué est refusé par le serveur : le laisser dans la liste ne menait qu'à
   * une erreur. Celui déjà attribué y reste pourtant même masqué — l'en retirer laisserait le
   * select sans option correspondante, donc vide, effaçant de l'écran l'attribution qu'il a
   * justement pour rôle de montrer.
   */
  protected assignableAdventurers(identity: AdminPortalIdentity): AdminAdventurer[] {
    return this.adventurers().filter(
      (adventurer) => adventurer.visible || adventurer.id === identity.adventurerId,
    );
  }

  protected updatePortalIdentityMode(identity: AdminPortalIdentity, accessMode: string) {
    if (!this.portalModes.includes(accessMode as PortalAccessMode)) {
      return;
    }
    this.savePortalAssignment(identity, {
      accessMode: accessMode as PortalAccessMode,
      adventurerId: accessMode === 'ADVENTURER' ? identity.adventurerId : null,
    });
  }

  /**
   * Retirer l'aventurier remet l'identité en attente de choix, et non en invité : c'est le seul
   * des deux modes qui rende la main au joueur. Le mode invité reste accessible explicitement
   * par l'autre liste, qui est faite pour cela.
   *
   * Le mode était auparavant forcé à `ADVENTURER` quel que soit le choix, si bien que
   * « Aucun » formait une attribution sans aventurier — que le serveur rejette.
   */
  protected updatePortalIdentityAdventurer(identity: AdminPortalIdentity, adventurerId: string) {
    this.savePortalAssignment(identity, adventurerId
      ? { accessMode: 'ADVENTURER', adventurerId }
      : { accessMode: 'UNASSIGNED', adventurerId: null });
  }

  private savePortalAssignment(identity: AdminPortalIdentity, update: AdminPortalAssignmentUpdate) {
    this.portalSaved.set(false);
    this.adminApi.updatePortalAssignment(identity.id, update).subscribe({
      next: () => {
        this.portalSaved.set(true);
        this.portalError.set(false);
        this.loadPortalIdentities();
        this.loadAuditLogs();
      },
      error: (failure: unknown) => this.showPortalError(failure),
    });
  }

  /** Le texte est déduit du seul code HTTP : aucun détail venu du serveur n'est relayé. */
  private showPortalError(failure?: unknown) {
    const conflict = failure instanceof HttpErrorResponse && failure.status === 409;
    this.portalErrorMessage.set(conflict ? PORTAL_ADVENTURER_TAKEN_ERROR : PORTAL_GENERIC_ERROR);
    this.portalSaved.set(false);
    this.portalError.set(true);
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

  private loadSettings() {
    this.adminApi.getSiteSettings().subscribe({
      next: (settings) => {
        this.settings.set(settings);
        this.settingsForm.set(this.toSettingsForm(settings));
        this.settingsError.set(false);
      },
      error: () => this.showSettingsError(),
    });
  }

  private loadRadarSettings() {
    this.adminApi.getRadarSettings().subscribe({
      next: (settings) => {
        this.radarSettings.set(settings);
        this.radarError.set(false);
      },
      error: () => this.radarError.set(true),
    });
  }

  private loadPortalIdentities() {
    this.adminApi.listPortalIdentities().subscribe({
      next: (identities) => {
        this.portalIdentities.set(identities);
        this.portalError.set(false);
      },
      error: () => this.showPortalError(),
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
    this.questPreview.set(null);
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

  private normalizedQuestPayload(payload: AdminQuestUpdate): AdminQuestUpdate {
    return {
      title: payload.title.trim(),
      summary: payload.summary.trim(),
      importantEventsMarkdown: payload.importantEventsMarkdown.trim(),
      discoveredCluesMarkdown: payload.discoveredCluesMarkdown.trim(),
      completedTrialsMarkdown: payload.completedTrialsMarkdown.trim(),
      extraContentMarkdown: payload.extraContentMarkdown.trim(),
      adminDraftMarkdown: payload.adminDraftMarkdown.trim(),
      status: payload.status,
      visibleToPlayers: payload.visibleToPlayers,
    };
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
      endsAt: this.toLocalDateTimeInput(message.endsAt, this.countdownTimezone()),
      expiredMessage: message.expiredMessage,
    };
  }

  private normalizedHomeMessagePayload(): AdminHomeMessageUpsert {
    const form = this.homeMessageForm();
    return {
      ...form,
      title: form.title.trim(),
      contentMarkdown: form.contentMarkdown.trim(),
      endsAt: form.countdownEnabled ? this.toOffsetDateTime(form.endsAt, this.countdownTimezone()) : null,
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
      labelPosition: 'TOP',
      labelOffsetPx: 16,
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
      labelPosition: marker.labelPosition,
      labelOffsetPx: marker.labelOffsetPx,
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
      labelPosition: form.labelPosition,
      labelOffsetPx: Number(form.labelOffsetPx),
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

  private markdownImageText(value: string) {
    return value.replace(/[\r\n]+/g, ' ').replace(/]/g, ')').trim();
  }

  private markdownImageTitle(value: string) {
    return this.markdownImageText(value).replace(/"/g, "'");
  }

  private toLocalDateTimeInput(value: string | null, timezone: string): string | null {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    const parts = this.dateTimeParts(date, timezone);
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }

  private toOffsetDateTime(value: string | null, timezone: string): string | null {
    if (!value) {
      return null;
    }
    const match = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2})$/.exec(value);
    if (!match?.groups) {
      return value;
    }
    const localUtc = Date.UTC(
      Number(match.groups['year']),
      Number(match.groups['month']) - 1,
      Number(match.groups['day']),
      Number(match.groups['hour']),
      Number(match.groups['minute']),
    );
    const firstOffset = this.timezoneOffsetMinutes(new Date(localUtc), timezone);
    const actualInstant = new Date(localUtc - firstOffset * 60_000);
    const offset = this.timezoneOffsetMinutes(actualInstant, timezone);
    return `${value}:00${this.formatOffset(offset)}`;
  }

  private timezoneOffsetMinutes(date: Date, timezone: string): number {
    const parts = this.dateTimeParts(date, timezone);
    const zonedUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    return Math.round((zonedUtc - date.getTime()) / 60_000);
  }

  private dateTimeParts(date: Date, timezone: string): Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', string> {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    return Object.fromEntries(
      formatter
        .formatToParts(date)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', string>;
  }

  private formatOffset(offsetMinutes: number): string {
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absolute = Math.abs(offsetMinutes);
    const hours = Math.floor(absolute / 60);
    const minutes = absolute % 60;
    return `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  private emptySettingsForm(): AdminSiteSettingsUpdate {
    return {
      siteName: '',
      subtitle: null,
      logoPath: null,
      timezone: 'Europe/Paris',
      status: 'ONLINE',
      maintenanceMessage: null,
      accessibilityInformationMarkdown: '',
    };
  }

  private toSettingsForm(settings: AdminSiteSettings): AdminSiteSettingsUpdate {
    return {
      siteName: settings.siteName,
      subtitle: settings.subtitle,
      logoPath: settings.logoPath,
      timezone: settings.timezone,
      status: settings.status,
      maintenanceMessage: settings.maintenanceMessage,
      accessibilityInformationMarkdown: settings.accessibilityInformationMarkdown,
    };
  }

  private normalizedSettingsPayload(): AdminSiteSettingsUpdate {
    const form = this.settingsForm();
    return {
      siteName: form.siteName.trim(),
      subtitle: this.trimToNull(form.subtitle),
      logoPath: this.trimToNull(form.logoPath),
      timezone: form.timezone.trim(),
      status: form.status,
      maintenanceMessage: form.status === 'MAINTENANCE' ? this.trimToNull(form.maintenanceMessage) : null,
      accessibilityInformationMarkdown: form.accessibilityInformationMarkdown.trim(),
    };
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

  private showMediaError(message: string = MEDIA_ERROR_GENERIC) {
    this.mediaErrorMessage.set(message);
    this.mediaError.set(true);
    this.focusSummary(this.mediaErrorSummary());
  }

  /**
   * Traduit un refus d'envoi de média.
   *
   * Le `413` vient du conteneur servlet, qui rejette pendant l'analyse du multipart : aucun
   * corps applicatif n'accompagne la réponse, seul le statut porte l'information.
   *
   * Les autres refus, eux, sont rendus en `application/problem+json` et leur champ `detail`
   * porte déjà un motif rédigé pour l'administrateur — signature invalide, image trop grande,
   * texte alternatif trop long. Le masquer derrière un message générique reproduirait
   * exactement la confusion que ces messages distincts viennent lever.
   */
  private mediaUploadErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return MEDIA_ERROR_GENERIC;
    }
    if (error.status === 413) {
      return MEDIA_ERROR_FILE_TOO_LARGE;
    }
    const problem = error.error as { detail?: unknown } | null;
    const detail = typeof problem?.detail === 'string' ? problem.detail.trim() : '';
    // Bornée aux 4xx : un 5xx ne doit jamais laisser filtrer un détail technique.
    return error.status >= 400 && error.status < 500 && detail ? detail : MEDIA_ERROR_GENERIC;
  }

  private showAllowedEmailError() {
    this.allowedEmailError.set(true);
    this.focusSummary(this.allowedEmailErrorSummary());
  }

  private showSettingsError() {
    this.settingsError.set(true);
    this.focusSummary(this.settingsErrorSummary());
  }

  private focusSummary(summary: ElementRef<HTMLElement> | undefined) {
    queueMicrotask(() => summary?.nativeElement.focus());
  }
}
