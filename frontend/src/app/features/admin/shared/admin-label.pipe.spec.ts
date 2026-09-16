import { AdminLabelPipe } from './admin-label.pipe';

describe('AdminLabelPipe', () => {
  const pipe = new AdminLabelPipe();

  it('traduit les valeurs techniques affichées dans l’administration', () => {
    expect(pipe.transform('PUBLISHED')).toBe('Publié');
    expect(pipe.transform('UNASSIGNED')).toBe('Non attribué');
    expect(pipe.transform('QUEST_IMMINENT')).toBe('Quête imminente');
  });

  it('préserve une valeur inconnue pour rester compatible avec une extension de l’API', () => {
    expect(pipe.transform('FUTURE_VALUE')).toBe('FUTURE_VALUE');
  });

  it('traduit les actions et types d’entités du journal d’audit', () => {
    expect(pipe.transform('QUEST_UPDATED')).toBe('Quête modifiée');
    expect(pipe.transform('PORTAL_IDENTITY_SUBJECT_REBOUND')).toBe('Identité portail réassociée');
    expect(pipe.transform('ADMIN_ALLOWED_EMAIL')).toBe('Adresse administrateur');
    expect(pipe.transform('RADAR_STATE')).toBe('État du Radar');
  });
});
