import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { MediaApiService } from '../../media-api.service';
import { AdminMarkdownEditorComponent } from './admin-markdown-editor';

describe('AdminMarkdownEditorComponent', () => {
  it('acts as a form control and applies Markdown at the current selection', async () => {
    await TestBed.configureTestingModule({
      imports: [AdminMarkdownEditorComponent],
      providers: [{ provide: MediaApiService, useValue: { listAdminMedia: () => of([]) } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminMarkdownEditorComponent);
    fixture.componentRef.setInput('label', 'Description');
    fixture.componentRef.setInput('controlId', 'description');
    let changed = '';
    fixture.componentInstance.registerOnChange((value) => (changed = value));
    fixture.componentInstance.writeValue('Texte');
    fixture.detectChanges();

    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    textarea.setSelectionRange(0, 5);
    const bold = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((button) => button.textContent?.trim() === 'Gras');
    bold?.click();

    expect(changed).toBe('**Texte**');
  });
});
