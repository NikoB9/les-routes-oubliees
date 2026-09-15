import { Component, ElementRef, computed, forwardRef, inject, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { MarkdownCommand, MarkdownToolbarComponent } from '../../../../shared/components/markdown-toolbar/markdown-toolbar';
import { AdminMedia } from '../../media-api.models';
import { MediaApiService } from '../../media-api.service';

type MarkdownImageSize = 'small' | 'medium' | 'large' | 'full';

@Component({
  selector: 'app-admin-markdown-editor',
  imports: [MarkdownToolbarComponent],
  templateUrl: './admin-markdown-editor.html',
  styleUrl: './admin-markdown-editor.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AdminMarkdownEditorComponent),
      multi: true,
    },
  ],
})
export class AdminMarkdownEditorComponent implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly controlId = input.required<string>();
  readonly rows = input(8);
  readonly required = input(false);
  readonly invalid = input(false);
  readonly describedBy = input<string | null>(null);

  private readonly mediaApi = inject(MediaApiService);
  private readonly textarea = viewChild.required<ElementRef<HTMLTextAreaElement>>('textarea');
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('imageDialog');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private trigger: HTMLElement | null = null;
  private onChange: (value: string) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  protected readonly media = signal<AdminMedia[]>([]);
  protected readonly mediaState = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  protected readonly imageSearch = signal('');
  protected readonly selectedImage = signal<AdminMedia | null>(null);
  protected readonly imageTitle = signal('');
  protected readonly imageSize = signal<MarkdownImageSize>('medium');
  protected readonly imageSizes: ReadonlyArray<{ value: MarkdownImageSize; label: string }> = [
    { value: 'small', label: 'Petit' },
    { value: 'medium', label: 'Moyen' },
    { value: 'large', label: 'Grand' },
    { value: 'full', label: 'Pleine largeur' },
  ];
  protected readonly filteredMedia = computed(() => {
    const query = this.imageSearch().trim().toLocaleLowerCase('fr-FR');
    return query
      ? this.media().filter((item) =>
          `${item.originalFilename} ${item.altText}`.toLocaleLowerCase('fr-FR').includes(query),
        )
      : this.media();
  });

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected updateValue(value: string): void {
    this.value.set(value);
    this.onChange(value);
  }

  protected applyMarkdown(command: MarkdownCommand): void {
    this.insertAtSelection(command.before, command.after, command.placeholder);
  }

  protected insertLink(): void {
    this.insertAtSelection('[', '](/notebook/QUEST_1)', 'libellé du lien');
  }

  protected openImageDialog(event: Event): void {
    this.trigger = event.currentTarget as HTMLElement;
    this.imageSearch.set('');
    this.selectedImage.set(null);
    this.imageTitle.set('');
    this.imageSize.set('medium');
    const dialog = this.dialog().nativeElement;
    dialog.showModal();
    window.setTimeout(() => this.searchInput()?.nativeElement.focus());
    this.loadMedia();
  }

  protected cancelImageDialog(event?: Event): void {
    event?.preventDefault();
    this.dialog().nativeElement.close();
    this.trigger?.focus();
    this.trigger = null;
  }

  protected selectImage(media: AdminMedia): void {
    this.selectedImage.set(media);
    this.imageTitle.set(media.altText);
  }

  protected updateImageSize(value: string): void {
    if (this.imageSizes.some((size) => size.value === value)) {
      this.imageSize.set(value as MarkdownImageSize);
    }
  }

  protected insertSelectedImage(): void {
    const media = this.selectedImage();
    if (!media) {
      return;
    }
    const alt = this.markdownText(media.altText || this.imageTitle() || media.originalFilename);
    const title = this.markdownText(this.imageTitle() || media.altText || media.originalFilename).replace(/"/g, "'");
    this.insertAtSelection('', '', `![${alt}](${media.url} "${title}"){size=${this.imageSize()}}`);
    this.cancelImageDialog();
  }

  private loadMedia(): void {
    this.mediaState.set('loading');
    this.mediaApi.listAdminMedia().subscribe({
      next: (media) => {
        this.media.set(media);
        this.mediaState.set('ready');
      },
      error: () => this.mediaState.set('error'),
    });
  }

  private insertAtSelection(before: string, after: string, placeholder: string): void {
    const textarea = this.textarea().nativeElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = this.value();
    const selected = current.slice(start, end) || placeholder;
    const insertion = `${before}${selected}${after}`;
    this.updateValue(`${current.slice(0, start)}${insertion}${current.slice(end)}`);
    window.setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  private markdownText(value: string): string {
    return value.replace(/[\r\n]+/g, ' ').replace(/]/g, ')').trim();
  }
}
