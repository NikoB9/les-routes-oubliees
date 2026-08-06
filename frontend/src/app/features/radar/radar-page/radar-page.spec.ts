import { Component, computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { PortalIdentityStore } from '../../../core/portal/portal-identity.store';
import { PortalMe } from '../../../core/portal/portal.models';
import { RadarApiService } from '../radar-api.service';
import { RadarLocationPayload, RadarSnapshot, RadarStreamEvent } from '../radar.models';
import { RadarPage } from './radar-page';

interface RadarPageInternals {
  ensureMap: () => Promise<void>;
  handlePosition: (position: GeolocationPosition) => Promise<void>;
  handleLocationError: (error: GeolocationPositionError) => void;
  requestLocation: () => void;
  loadSnapshot: () => void;
  startEvents: () => void;
  streamError: () => boolean;
  publishError: () => boolean;
  watchId: number | null;
}

describe('RadarPage', () => {
  let fixture: ComponentFixture<RadarPage>;
  let radarApi: {
    snapshot: ReturnType<typeof vi.fn>;
    updateLocation: ReturnType<typeof vi.fn>;
    events: ReturnType<typeof vi.fn>;
    announceDeparture: ReturnType<typeof vi.fn>;
  };
  let clearWatch: ReturnType<typeof vi.fn>;
  let watchPosition: ReturnType<typeof vi.fn>;

  const portal: PortalMe = {
    identity: {
      id: 'identity-1',
      accessMode: 'GUEST',
      adventurerId: null,
      displayName: 'Invite',
      avatarPath: null,
      selectedAt: '2026-08-05T12:00:00Z',
    },
    availableAdventurers: [],
    guestAvailable: false,
    canAccessAdmin: false,
  };
  const portalSignal = signal(portal);

  const snapshot: RadarSnapshot = {
    serverTime: '2026-08-05T12:00:00Z',
    currentIdentity: {
      identityId: 'identity-1',
      accessMode: 'GUEST',
      adventurerId: null,
      displayName: 'Invite',
      avatarPath: null,
    },
    treasure: null,
    participants: [],
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    clearWatch = vi.fn();
    watchPosition = vi.fn(() => 42);
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition,
        clearWatch,
      },
    });

    radarApi = {
      snapshot: vi.fn(() => of(snapshot)),
      updateLocation: vi.fn(() => of(undefined)),
      events: vi.fn(() => of<RadarStreamEvent>({ kind: 'snapshot', snapshot })),
      announceDeparture: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [RadarPage],
      providers: [
        {
          provide: PortalIdentityStore,
          useValue: {
            portal: portalSignal,
            identity: computed(() => portalSignal().identity),
            loading: signal(false),
            loaded: signal(true),
            error: signal(false),
            needsAssignment: computed(() => false),
            load: vi.fn(),
          },
        },
        {
          provide: RadarApiService,
          useValue: radarApi,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RadarPage);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  it('never starts geolocation before the adventurer opens the Radar', () => {
    expect(watchPosition).not.toHaveBeenCalled();
    expect(radarApi.updateLocation).not.toHaveBeenCalled();
  });

  it('starts the geolocation watch when the Radar is opened', () => {
    const component = fixture.componentInstance as unknown as RadarPageInternals;
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });

    component.requestLocation();

    expect(watchPosition).toHaveBeenCalledTimes(1);
    // Aucune publication avant la reception d'une position valide.
    expect(radarApi.updateLocation).not.toHaveBeenCalled();
  });

  it('publishes the latest known position every seven seconds', async () => {
    const component = fixture.componentInstance as unknown as RadarPageInternals;
    vi.spyOn(component, 'ensureMap').mockResolvedValue(undefined);

    await component.handlePosition(position(46.495854, -1.775551));

    expect(radarApi.updateLocation).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(63_000);

    expect(radarApi.updateLocation).toHaveBeenCalledTimes(10);
    expect(radarApi.updateLocation).toHaveBeenLastCalledWith({
      latitude: 46.495854,
      longitude: -1.775551,
      accuracyM: 6,
      observedAt: '2026-08-05T12:00:00.000Z',
    } satisfies RadarLocationPayload);
  });

  it('keeps a motionless adventurer present without any new GPS callback', async () => {
    const component = fixture.componentInstance as unknown as RadarPageInternals;
    vi.spyOn(component, 'ensureMap').mockResolvedValue(undefined);

    await component.handlePosition(position(46.1, -1.1));
    const initialCalls = radarApi.updateLocation.mock.calls.length;

    // 45 secondes de TTL serveur : au moins six republications doivent survenir.
    vi.advanceTimersByTime(45_000);

    expect(radarApi.updateLocation.mock.calls.length - initialCalls).toBeGreaterThanOrEqual(6);
  });

  it('stops the geolocation watch, the timer and the stream when leaving Radar', async () => {
    const component = fixture.componentInstance as unknown as RadarPageInternals;
    vi.spyOn(component, 'ensureMap').mockResolvedValue(undefined);
    component.watchId = 77;

    await component.handlePosition(position(46.1, -1.1));
    expect(radarApi.updateLocation).toHaveBeenCalledTimes(1);

    fixture.destroy();
    vi.advanceTimersByTime(70_000);

    expect(clearWatch).toHaveBeenCalledWith(77);
    expect(radarApi.updateLocation).toHaveBeenCalledTimes(1);
  });

  it('announces the departure when leaving Radar after publishing a position', async () => {
    const component = fixture.componentInstance as unknown as RadarPageInternals;
    vi.spyOn(component, 'ensureMap').mockResolvedValue(undefined);

    await component.handlePosition(position(46.1, -1.1));
    fixture.destroy();

    expect(radarApi.announceDeparture).toHaveBeenCalledTimes(1);
  });

  it('does not announce a departure when no position was ever published', () => {
    fixture.destroy();

    expect(radarApi.announceDeparture).not.toHaveBeenCalled();
  });

  it('does not publish concurrent locations and keeps only the latest pending position', async () => {
    const firstPublish = new Subject<void>();
    radarApi.updateLocation.mockImplementationOnce(() => firstPublish.asObservable());
    radarApi.updateLocation.mockImplementation(() => of(undefined));
    const component = fixture.componentInstance as unknown as RadarPageInternals;
    vi.spyOn(component, 'ensureMap').mockResolvedValue(undefined);

    await component.handlePosition(position(46.1, -1.1));
    await component.handlePosition(position(46.2, -1.2));
    await component.handlePosition(position(46.3, -1.3));

    expect(radarApi.updateLocation).toHaveBeenCalledTimes(1);

    firstPublish.complete();

    // Une seule position en attente : la derniere connue.
    expect(radarApi.updateLocation).toHaveBeenCalledTimes(2);
    expect(radarApi.updateLocation).toHaveBeenLastCalledWith({
      latitude: 46.3,
      longitude: -1.3,
      accuracyM: 6,
      observedAt: '2026-08-05T12:00:00.000Z',
    } satisfies RadarLocationPayload);
  });

  it('cancels an in-flight publication on destruction and ignores its late response', async () => {
    const pending = new Subject<void>();
    radarApi.updateLocation.mockImplementation(() => pending.asObservable());
    const component = fixture.componentInstance as unknown as RadarPageInternals;
    vi.spyOn(component, 'ensureMap').mockResolvedValue(undefined);

    await component.handlePosition(position(46.1, -1.1));
    expect(radarApi.updateLocation).toHaveBeenCalledTimes(1);

    fixture.destroy();
    pending.next();
    pending.complete();
    vi.advanceTimersByTime(70_000);

    expect(radarApi.updateLocation).toHaveBeenCalledTimes(1);
  });

  it('never lets finalize() publish again after destruction', async () => {
    const pending = new Subject<void>();
    radarApi.updateLocation.mockImplementationOnce(() => pending.asObservable());
    radarApi.updateLocation.mockImplementation(() => of(undefined));
    const component = fixture.componentInstance as unknown as RadarPageInternals;
    vi.spyOn(component, 'ensureMap').mockResolvedValue(undefined);

    await component.handlePosition(position(46.1, -1.1));
    // Une position est mise en attente pendant que le premier PUT est en vol.
    await component.handlePosition(position(46.2, -1.2));
    expect(radarApi.updateLocation).toHaveBeenCalledTimes(1);

    fixture.destroy();
    pending.complete();
    vi.advanceTimersByTime(70_000);

    expect(radarApi.updateLocation).toHaveBeenCalledTimes(1);
  });

  it('ignores a late geolocation callback received after destruction', async () => {
    const component = fixture.componentInstance as unknown as RadarPageInternals;
    vi.spyOn(component, 'ensureMap').mockResolvedValue(undefined);

    fixture.destroy();
    await component.handlePosition(position(46.4, -1.4));
    vi.advanceTimersByTime(70_000);

    expect(radarApi.updateLocation).not.toHaveBeenCalled();
  });

  it('stops publishing when geolocation permission is lost', async () => {
    const component = fixture.componentInstance as unknown as RadarPageInternals;
    vi.spyOn(component, 'ensureMap').mockResolvedValue(undefined);
    component.watchId = 91;

    await component.handlePosition(position(46.1, -1.1));
    component.handleLocationError(locationError(1));
    vi.advanceTimersByTime(70_000);

    expect(clearWatch).toHaveBeenCalledWith(91);
    expect(radarApi.updateLocation).toHaveBeenCalledTimes(1);
  });

  /**
   * La permission perdue est définitive : attendre le TTL serveur laisserait un repère
   * immobile pendant 45 secondes alors que le départ est déjà certain.
   */
  it('announces the departure as soon as the permission is denied', async () => {
    const component = fixture.componentInstance as unknown as RadarPageInternals;
    vi.spyOn(component, 'ensureMap').mockResolvedValue(undefined);

    await component.handlePosition(position(46.1, -1.1));
    component.handleLocationError(locationError(1));

    expect(radarApi.announceDeparture).toHaveBeenCalledTimes(1);

    // La destruction qui suit ne doit pas envoyer un second depart.
    fixture.destroy();

    expect(radarApi.announceDeparture).toHaveBeenCalledTimes(1);
  });

  it('does not announce a departure when the permission is denied before any publication', () => {
    const component = fixture.componentInstance as unknown as RadarPageInternals;

    component.handleLocationError(locationError(1));

    expect(radarApi.announceDeparture).not.toHaveBeenCalled();
  });

  /**
   * Le sondage de secours ne couvre qu'une coupure : il doit s'arrêter dès le retour du
   * flux, sans quoi la page resterait en mode dégradé pour le reste de la session — le
   * défaut que la reconnexion native corrige.
   */
  it('polls while the stream is reconnecting, then stops as soon as it recovers', () => {
    const stream = new Subject<RadarStreamEvent>();
    radarApi.events.mockReturnValue(stream.asObservable());
    const component = fixture.componentInstance as unknown as RadarPageInternals;
    component.startEvents();
    const beforeOutage = radarApi.snapshot.mock.calls.length;

    stream.next({ kind: 'reconnecting' });
    vi.advanceTimersByTime(30_000);

    expect(component.streamError()).toBe(true);
    expect(radarApi.snapshot.mock.calls.length - beforeOutage).toBe(3);

    stream.next({ kind: 'connected' });
    const afterRecovery = radarApi.snapshot.mock.calls.length;
    vi.advanceTimersByTime(30_000);

    expect(component.streamError()).toBe(false);
    expect(radarApi.snapshot.mock.calls.length).toBe(afterRecovery);
  });

  /** Un tirage en échec ne doit pas emporter le sondage : c'est le seul relais disponible. */
  it('keeps polling after a failed snapshot', () => {
    const stream = new Subject<RadarStreamEvent>();
    radarApi.events.mockReturnValue(stream.asObservable());
    radarApi.snapshot.mockReturnValue(throwError(() => new Error('offline')));
    const component = fixture.componentInstance as unknown as RadarPageInternals;
    component.startEvents();
    const beforeOutage = radarApi.snapshot.mock.calls.length;

    stream.next({ kind: 'reconnecting' });
    vi.advanceTimersByTime(30_000);

    expect(radarApi.snapshot.mock.calls.length - beforeOutage).toBe(3);
    expect(component.streamError()).toBe(true);
  });

  /**
   * Une publication en échec rend l'aventurier invisible aux autres, ce qui n'a rien à voir
   * avec sa propre réception. Un seul signal pour les deux causes affichait un message faux,
   * qu'un instantané reçu effaçait de surcroît quelques secondes plus tard.
   */
  it('signals a failed publication apart from the reception banner', async () => {
    radarApi.updateLocation.mockReturnValue(throwError(() => new Error('offline')));
    const component = fixture.componentInstance as unknown as RadarPageInternals;
    vi.spyOn(component, 'ensureMap').mockResolvedValue(undefined);

    await component.handlePosition(position(46.1, -1.1));

    expect(component.publishError()).toBe(true);
    expect(component.streamError()).toBe(false);

    // Recevoir un instantané prouve la réception, jamais la publication : le message tient.
    component.startEvents();

    expect(component.publishError()).toBe(true);
  });

  it('clears the publication warning as soon as a publication succeeds', async () => {
    radarApi.updateLocation.mockReturnValueOnce(throwError(() => new Error('offline')));
    const component = fixture.componentInstance as unknown as RadarPageInternals;
    vi.spyOn(component, 'ensureMap').mockResolvedValue(undefined);

    await component.handlePosition(position(46.1, -1.1));
    expect(component.publishError()).toBe(true);

    vi.advanceTimersByTime(7000);

    expect(component.publishError()).toBe(false);
  });

  /** Le premier état manquant est déjà une réception dégradée : elle doit se rattraper seule. */
  it('falls back to polling when the initial snapshot fails', () => {
    radarApi.snapshot.mockReturnValue(throwError(() => new Error('offline')));
    const component = fixture.componentInstance as unknown as RadarPageInternals;

    component.loadSnapshot();
    const beforeOutage = radarApi.snapshot.mock.calls.length;
    vi.advanceTimersByTime(30_000);

    expect(component.streamError()).toBe(true);
    expect(radarApi.snapshot.mock.calls.length - beforeOutage).toBe(3);
  });

  /**
   * Une coupure définitive laissait la session entière en sondage : le mode dégradé sans issue
   * que la reconnexion native venait justement de supprimer, revenu par une autre porte.
   */
  it('reopens the direct stream a minute after a definitive failure', () => {
    const stream = new Subject<RadarStreamEvent>();
    radarApi.events.mockReturnValueOnce(throwError(() => new Error('closed')));
    radarApi.events.mockReturnValue(stream.asObservable());
    const component = fixture.componentInstance as unknown as RadarPageInternals;
    const beforeOutage = radarApi.events.mock.calls.length;

    component.startEvents();

    expect(radarApi.events.mock.calls.length - beforeOutage).toBe(1);
    expect(component.streamError()).toBe(true);

    vi.advanceTimersByTime(60_000);

    expect(radarApi.events.mock.calls.length - beforeOutage).toBe(2);

    // Le direct rétabli referme le mode dégradé.
    stream.next({ kind: 'connected' });

    expect(component.streamError()).toBe(false);
  });

  function position(latitude: number, longitude: number): GeolocationPosition {
    return {
      coords: {
        latitude,
        longitude,
        accuracy: 6,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: Date.parse('2026-08-05T12:00:00Z'),
      toJSON: () => ({}),
    };
  }

  function locationError(code: number): GeolocationPositionError {
    return {
      code,
      message: 'Permission denied',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    };
  }
});

@Component({
  selector: 'app-other-page-host',
  template: '<p>Une autre page</p>',
})
class OtherPageComponent {}

describe('pages other than Radar', () => {
  let watchPosition: ReturnType<typeof vi.fn>;
  let getCurrentPosition: ReturnType<typeof vi.fn>;
  let updateLocation: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    watchPosition = vi.fn(() => 1);
    getCurrentPosition = vi.fn();
    updateLocation = vi.fn(() => of(undefined));
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { watchPosition, getCurrentPosition, clearWatch: vi.fn() },
    });

    await TestBed.configureTestingModule({
      imports: [OtherPageComponent],
      providers: [
        {
          provide: RadarApiService,
          useValue: {
            snapshot: vi.fn(),
            updateLocation,
            events: vi.fn(),
            announceDeparture: vi.fn(),
          },
        },
      ],
    }).compileComponents();
  });

  it('never requests a position nor publishes one', () => {
    const fixture = TestBed.createComponent(OtherPageComponent);
    fixture.detectChanges();

    expect(watchPosition).not.toHaveBeenCalled();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(updateLocation).not.toHaveBeenCalled();

    fixture.destroy();
  });
});
