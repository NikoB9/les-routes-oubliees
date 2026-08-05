import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { PortalApiService } from '../../../core/portal/portal-api.service';
import { PortalMe } from '../../../core/portal/portal.models';
import { RadarApiService } from '../radar-api.service';
import { RadarLocationPayload, RadarSnapshot } from '../radar.models';
import { RadarPage } from './radar-page';

describe('RadarPage', () => {
  let fixture: ComponentFixture<RadarPage>;
  let radarApi: {
    snapshot: ReturnType<typeof vi.fn>;
    updateLocation: ReturnType<typeof vi.fn>;
    events: ReturnType<typeof vi.fn>;
  };
  let clearWatch: ReturnType<typeof vi.fn>;

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
  };

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
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: vi.fn(),
        clearWatch,
      },
    });

    radarApi = {
      snapshot: vi.fn(() => of(snapshot)),
      updateLocation: vi.fn(() => of(undefined)),
      events: vi.fn(() => of(snapshot)),
    };

    await TestBed.configureTestingModule({
      imports: [RadarPage],
      providers: [
        {
          provide: PortalApiService,
          useValue: {
            me: vi.fn(() => of(portal)),
            chooseAdventurer: vi.fn(),
            chooseGuest: vi.fn(),
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

  it('publishes the latest known position every seven seconds while visible', async () => {
    const component = fixture.componentInstance as unknown as {
      ensureMap: () => Promise<void>;
      handlePosition: (position: GeolocationPosition) => Promise<void>;
    };
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

  it('stops the geolocation watch and interval when leaving Radar', async () => {
    const component = fixture.componentInstance as unknown as {
      ensureMap: () => Promise<void>;
      handlePosition: (position: GeolocationPosition) => Promise<void>;
      watchId: number;
    };
    vi.spyOn(component, 'ensureMap').mockResolvedValue(undefined);
    component.watchId = 77;

    await component.handlePosition(position(46.1, -1.1));
    expect(radarApi.updateLocation).toHaveBeenCalledTimes(1);

    fixture.destroy();
    vi.advanceTimersByTime(70_000);

    expect(clearWatch).toHaveBeenCalledWith(77);
    expect(radarApi.updateLocation).toHaveBeenCalledTimes(1);
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
});
