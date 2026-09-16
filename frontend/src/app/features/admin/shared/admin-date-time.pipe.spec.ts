import { AdminDateTimePipe } from './admin-date-time.pipe';

describe('AdminDateTimePipe', () => {
  const pipe = new AdminDateTimePipe();

  it('présente une date ISO dans un format français lisible', () => {
    const formatted = pipe.transform('2026-09-14T10:00:00Z');

    expect(formatted).toContain('2026');
    expect(formatted).toContain('septembre');
    expect(formatted).not.toContain('T10:00:00Z');
  });

  it('préserve une valeur invalide reçue de l’API', () => {
    expect(pipe.transform('date-inconnue')).toBe('date-inconnue');
  });
});
