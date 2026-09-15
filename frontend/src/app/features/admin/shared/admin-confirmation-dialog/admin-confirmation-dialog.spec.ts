import { TestBed } from '@angular/core/testing';

import { AdminConfirmationDialogComponent } from './admin-confirmation-dialog';

describe('AdminConfirmationDialogComponent', () => {
  it('uses a native dialog and emits confirmation only after the explicit action', async () => {
    await TestBed.configureTestingModule({ imports: [AdminConfirmationDialogComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AdminConfirmationDialogComponent);
    fixture.componentRef.setInput('title', 'Supprimer ?');
    fixture.componentRef.setInput('message', 'Cette action est irréversible.');
    fixture.detectChanges();
    let confirmed = false;
    fixture.componentInstance.confirmed.subscribe(() => (confirmed = true));
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => dialog.removeAttribute('open');

    fixture.componentInstance.open();
    const confirmButton = fixture.nativeElement.querySelector('.danger') as HTMLButtonElement;
    confirmButton.click();

    expect(confirmed).toBe(true);
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('restaure le focus au déclencheur après une annulation', async () => {
    await TestBed.configureTestingModule({ imports: [AdminConfirmationDialogComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AdminConfirmationDialogComponent);
    fixture.componentRef.setInput('title', 'Supprimer ?');
    fixture.componentRef.setInput('message', 'Cette action est irréversible.');
    fixture.detectChanges();
    const trigger = document.createElement('button');
    document.body.append(trigger);
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => dialog.removeAttribute('open');

    fixture.componentInstance.open(trigger);
    (fixture.nativeElement.querySelector('.secondary') as HTMLButtonElement).click();

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('restaure le focus au déclencheur encore présent après une confirmation', async () => {
    await TestBed.configureTestingModule({ imports: [AdminConfirmationDialogComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AdminConfirmationDialogComponent);
    fixture.componentRef.setInput('title', 'Archiver ?');
    fixture.componentRef.setInput('message', 'La quête sera archivée.');
    fixture.detectChanges();
    const trigger = document.createElement('button');
    document.body.append(trigger);
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => dialog.removeAttribute('open');

    fixture.componentInstance.open(trigger);
    (fixture.nativeElement.querySelector('.danger') as HTMLButtonElement).click();
    await new Promise((resolve) => window.setTimeout(resolve));

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
