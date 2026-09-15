import { Component, ElementRef, input, output, viewChild } from '@angular/core';

@Component({
  selector: 'app-admin-confirmation-dialog',
  templateUrl: './admin-confirmation-dialog.html',
  styleUrl: './admin-confirmation-dialog.css',
})
export class AdminConfirmationDialogComponent {
  readonly dialogId = input('admin-confirmation');
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Confirmer');
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private trigger: HTMLElement | null = null;

  open(trigger?: EventTarget | null): void {
    this.trigger = trigger instanceof HTMLElement ? trigger : document.activeElement as HTMLElement | null;
    const dialog = this.dialog().nativeElement;
    if (!dialog.open) {
      dialog.showModal();
      window.setTimeout(() => dialog.querySelector<HTMLButtonElement>('.secondary')?.focus());
    }
  }

  protected confirm(): void {
    const trigger = this.trigger;
    this.trigger = null;
    this.dialog().nativeElement.close();
    this.confirmed.emit();
    window.setTimeout(() => {
      const mainContent = document.getElementById('main-content');
      (trigger?.isConnected ? trigger : mainContent)?.focus();
    });
  }

  protected cancel(event?: Event): void {
    event?.preventDefault();
    this.dialog().nativeElement.close();
    this.cancelled.emit();
    this.restoreFocus();
  }

  private restoreFocus(): void {
    this.trigger?.focus();
    this.trigger = null;
  }
}
