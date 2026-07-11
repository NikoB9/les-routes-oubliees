create table home_messages (
    id uuid primary key,
    title varchar(160) not null,
    content_markdown text not null,
    importance varchar(32) not null,
    status varchar(32) not null,
    active boolean not null,
    countdown_enabled boolean not null,
    ends_at timestamptz,
    expired_message varchar(280),
    last_modified_by varchar(320),
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint ck_home_messages_importance check (importance in ('INFORMATION', 'WARNING', 'QUEST_IMMINENT', 'SUCCESS', 'MYSTERY')),
    constraint ck_home_messages_status check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    constraint ck_home_messages_active_published check (active = false or status = 'PUBLISHED'),
    constraint ck_home_messages_archived_inactive check (status <> 'ARCHIVED' or active = false),
    constraint ck_home_messages_countdown_end check (countdown_enabled = false or ends_at is not null)
);

create unique index uk_home_messages_active on home_messages (active) where active;
create index idx_home_messages_public on home_messages (active, status);

create table company_profiles (
    id uuid primary key,
    name varchar(160) not null,
    emblem_path varchar(255),
    image_alt varchar(280),
    short_description varchar(500) not null,
    long_description_markdown text not null,
    active boolean not null,
    created_at timestamptz not null,
    updated_at timestamptz not null
);

create unique index uk_company_profiles_active on company_profiles (active) where active;

create table adventurers (
    id uuid primary key,
    name varchar(160) not null,
    title varchar(160) not null,
    avatar_path varchar(255),
    avatar_alt varchar(280),
    short_description varchar(500) not null,
    strengths text not null,
    weaknesses text not null,
    visible boolean not null,
    display_order integer not null,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint uk_adventurers_display_order unique (display_order),
    constraint ck_adventurers_display_order check (display_order > 0)
);

create index idx_adventurers_public_order on adventurers (visible, display_order);

create table map_visions (
    id uuid primary key,
    name varchar(160) not null,
    description_markdown text not null,
    asset_path varchar(255) not null,
    image_alt varchar(280) not null,
    display_order integer not null,
    status varchar(32) not null,
    active boolean not null,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint uk_map_visions_display_order unique (display_order),
    constraint ck_map_visions_display_order check (display_order > 0),
    constraint ck_map_visions_status check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    constraint ck_map_visions_active_published check (active = false or status = 'PUBLISHED'),
    constraint ck_map_visions_archived_inactive check (status <> 'ARCHIVED' or active = false)
);

create unique index uk_map_visions_active on map_visions (active) where active;
create index idx_map_visions_public on map_visions (active, status);

create table quests (
    id uuid primary key,
    code varchar(40) not null,
    title varchar(160) not null,
    summary varchar(700) not null,
    important_events_markdown text not null,
    discovered_clues_markdown text not null,
    completed_trials_markdown text not null,
    extra_content_markdown text not null,
    status varchar(32) not null,
    visible_to_players boolean not null,
    display_order integer not null,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint uk_quests_code unique (code),
    constraint uk_quests_display_order unique (display_order),
    constraint ck_quests_code check (code in ('QUEST_1', 'QUEST_2', 'QUEST_3', 'QUEST_4', 'VAL_D_AURELUNE')),
    constraint ck_quests_display_order check (display_order between 1 and 5),
    constraint ck_quests_status check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    constraint ck_quests_visible_published check (visible_to_players = false or status = 'PUBLISHED')
);

create index idx_quests_public_order on quests (status, visible_to_players, display_order);
