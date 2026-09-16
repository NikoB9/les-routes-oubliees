import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AdminLayoutShell } from './admin-layout';

describe('AdminLayout', () => {
  it('exposes the current admin page in the navigation', async () => {
    await TestBed.configureTestingModule({
      imports: [AdminLayoutShell],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminLayoutShell);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('/api/admin/me').flush({
      authenticated: true,
      email: 'admin@example.test',
      roles: ['ADMIN'],
    });
    fixture.detectChanges();

    const navigation = fixture.nativeElement.querySelector('nav') as HTMLElement;
    expect(navigation.textContent).toContain('Tableau de bord');
    expect(navigation.querySelectorAll('a').length).toBe(12);
  });
});
