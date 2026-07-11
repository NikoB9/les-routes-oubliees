alter table quests
    add column admin_draft_markdown text not null default '';

create table map_markers (
    id uuid primary key,
    quest_id uuid not null references quests (id),
    title varchar(160) not null,
    position_x numeric(6, 3) not null,
    position_y numeric(6, 3) not null,
    active boolean not null,
    display_order integer not null,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint uk_map_markers_quest_id unique (quest_id),
    constraint uk_map_markers_display_order unique (display_order),
    constraint ck_map_markers_position_x check (position_x >= 0 and position_x <= 100),
    constraint ck_map_markers_position_y check (position_y >= 0 and position_y <= 100),
    constraint ck_map_markers_display_order check (display_order > 0)
);

create index idx_map_markers_active_order on map_markers (active, display_order);
