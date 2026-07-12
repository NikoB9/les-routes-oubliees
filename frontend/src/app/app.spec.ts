import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the application brand', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-title')?.textContent).toContain('Les Routes');
  });

  it('should expose accessible public navigation landmarks', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.skip-link')?.getAttribute('href')).toBe('#main-content');
    expect(compiled.querySelector('main')?.id).toBe('main-content');
    expect(compiled.querySelector('.desktop-nav')?.getAttribute('aria-labelledby')).toBe(
      'primary-navigation-title',
    );
    expect(compiled.querySelector('.mobile-nav')?.getAttribute('aria-label')).toBe(
      'Navigation principale mobile',
    );
  });

  it('should render the public navigation links once per navigation surface', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const desktopLinks = Array.from(compiled.querySelectorAll('.desktop-nav .link-label')).map(
      (link) => link.textContent?.trim(),
    );
    const mobileLinks = Array.from(compiled.querySelectorAll('.mobile-nav a')).map((link) =>
      link.textContent?.trim(),
    );

    expect(desktopLinks).toEqual(['Accueil', 'Carte', 'Carnet']);
    expect(mobileLinks).toEqual(['Accueil', 'Carte', 'Carnet']);
  });

  it('should expose a direct accessible admin login link', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const adminLink = compiled.querySelector<HTMLAnchorElement>('.admin-gate-link');

    expect(adminLink?.textContent).toContain('Acces admin');
    expect(adminLink?.getAttribute('href')).toBe('/admin/login');
  });
});
