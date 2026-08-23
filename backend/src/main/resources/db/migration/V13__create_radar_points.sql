create table radar_points (
    id uuid primary key,
    title varchar(160) not null,
    description text not null,
    latitude numeric(9, 6) not null,
    longitude numeric(9, 6) not null,
    active boolean not null,
    display_order integer not null,
    source_image_key varchar(120) null,
    image_media_id uuid null references media_assets(id),
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint uk_radar_points_display_order unique (display_order),
    constraint ck_radar_points_latitude check (latitude between -90 and 90),
    constraint ck_radar_points_longitude check (longitude between -180 and 180),
    constraint ck_radar_points_display_order check (display_order > 0)
);

create index idx_radar_points_active_order on radar_points(active, display_order);
create index idx_radar_points_image_media on radar_points(image_media_id);
