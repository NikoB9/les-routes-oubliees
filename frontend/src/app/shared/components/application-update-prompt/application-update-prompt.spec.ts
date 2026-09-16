import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';

import { ApplicationUpdateService } from '../../../core/pwa/application-update.service';
import { ApplicationUpdatePromptComponent } from './application-update-prompt';

describe('ApplicationUpdatePromptComponent', () => {
  it('announces an available update and reloads on explicit request', async () => {
    const reload = vi.fn();
    const isAvailable = signal(false);

    await TestBed.configureTestingModule({
      imports: [ApplicationUpdatePromptComponent],
      providers: [
        {
          provide: ApplicationUpdateService,
          useValue: {
            isAvailable,
            isRecoveryRequired: signal(false),
            reload,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ApplicationUpdatePromptComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const announcement = compiled.querySelector<HTMLElement>('[role="status"]');

    expect(announcement?.getAttribute('aria-live')).toBe('polite');
    expect(announcement?.textContent?.trim()).toBe('');
    expect(compiled.querySelector('section')).toBeNull();

    isAvailable.set(true);
    fixture.detectChanges();

    const prompt = compiled.querySelector('section');
    const button = compiled.querySelector<HTMLButtonElement>('button');

    expect(announcement?.textContent).toContain('Une nouvelle version');
    expect(prompt?.getAttribute('aria-labelledby')).toBe('update-prompt-title');
    expect(compiled.textContent).toContain('Mise à jour disponible');
    expect(button?.textContent?.trim()).toBe('Mettre à jour');

    button?.click();
    expect(reload).toHaveBeenCalledOnce();
  });
});
