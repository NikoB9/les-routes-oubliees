create table portal_identities (
    id uuid primary key,
    cloudflare_subject varchar(255) not null,
    normalized_email varchar(320) not null,
    adventurer_id uuid null references adventurers(id),
    access_mode varchar(32) not null,
    selected_at timestamptz null,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint uq_portal_identities_subject unique (cloudflare_subject),
    constraint uq_portal_identities_email unique (normalized_email),
    constraint ck_portal_identities_access_mode check (access_mode in ('UNASSIGNED', 'ADVENTURER', 'GUEST')),
    constraint ck_portal_identities_assignment check (
        (access_mode = 'UNASSIGNED' and adventurer_id is null and selected_at is null)
        or
        (access_mode = 'ADVENTURER' and adventurer_id is not null and selected_at is not null)
        or
        (access_mode = 'GUEST' and adventurer_id is null and selected_at is not null)
    )
);

create unique index uq_portal_identities_adventurer
    on portal_identities(adventurer_id)
    where adventurer_id is not null;

create index idx_portal_identities_assignment on portal_identities(access_mode, adventurer_id);

create table radar_state (
    id smallint primary key,
    treasure_visible boolean not null,
    treasure_latitude numeric(9, 6) null,
    treasure_longitude numeric(9, 6) null,
    treasure_accuracy_m numeric(8, 2) null,
    treasure_observed_at timestamptz null,
    treasure_received_at timestamptz null,
    treasure_visibility_updated_by uuid null references portal_identities(id),
    treasure_visibility_updated_at timestamptz null,
    constraint ck_radar_state_singleton check (id = 1),
    constraint ck_radar_state_latitude check (treasure_latitude is null or treasure_latitude between -90 and 90),
    constraint ck_radar_state_longitude check (treasure_longitude is null or treasure_longitude between -180 and 180),
    constraint ck_radar_state_accuracy check (treasure_accuracy_m is null or treasure_accuracy_m > 0)
);

insert into radar_state(id, treasure_visible)
values (1, false);
