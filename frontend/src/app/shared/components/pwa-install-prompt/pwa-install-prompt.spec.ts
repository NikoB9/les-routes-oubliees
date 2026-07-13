import { TestBed } from '@angular/core/testing';

import { PwaInstallPromptService } from '../../../core/pwa/pwa-install-prompt.service';
import { PwaInstallPromptComponent } from './pwa-install-prompt';

describe('PwaInstallPromptComponent', () => {
  it('renders install and close actions when installation is available', async () => {
    await TestBed.configureTestingModule({
      imports: [PwaInstallPromptComponent],
      providers: [
        {
          provide: PwaInstallPromptService,
          useValue: {
            canInstall: () => true,
            showIosHelp: () => false,
            install: () => Promise.resolve(),
            dismiss: () => undefined,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PwaInstallPromptComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(compiled.querySelectorAll('button')).map((button) =>
      button.textContent?.trim(),
    );

    expect(compiled.textContent).toContain("Installer l'application");
    expect(compiled.querySelector('section')?.getAttribute('aria-live')).toBe('polite');
    expect(compiled.querySelector('section')?.getAttribute('role')).toBe('status');
    expect(compiled.querySelector('.secondary-action')?.getAttribute('aria-label')).toBe(
      "Fermer l'invite d'installation",
    );
    expect(buttons).toEqual(['Installer', 'Fermer']);
  });
});
