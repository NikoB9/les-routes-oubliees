import { formatFileSize, toLocalDateTimeInput, toOffsetDateTime } from './admin-format.utils';

describe('admin format utilities', () => {
  it('formats binary file sizes', () => {
    expect(formatFileSize(2_516_582)).toBe('2.4 Mio');
    expect(formatFileSize(-1)).toBe('Taille inconnue');
  });

  it('converts Paris local dates using the seasonal offset', () => {
    expect(toOffsetDateTime('2026-07-12T20:00', 'Europe/Paris')).toBe('2026-07-12T20:00:00+02:00');
    expect(toOffsetDateTime('2026-12-12T20:00', 'Europe/Paris')).toBe('2026-12-12T20:00:00+01:00');
    expect(toLocalDateTimeInput('2026-07-12T18:00:00Z', 'Europe/Paris')).toBe('2026-07-12T20:00');
  });
});
