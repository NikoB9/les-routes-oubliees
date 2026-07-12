create table media_assets (
    id uuid primary key,
    original_filename varchar(255) not null,
    stored_filename varchar(120) not null,
    relative_path varchar(255) not null,
    mime_type varchar(40) not null,
    size_bytes bigint not null,
    width integer not null,
    height integer not null,
    alt_text varchar(280) not null,
    created_at timestamptz not null,
    created_by varchar(320),
    constraint uk_media_assets_stored_filename unique (stored_filename),
    constraint uk_media_assets_relative_path unique (relative_path),
    constraint ck_media_assets_mime_type check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
    constraint ck_media_assets_size check (size_bytes > 0),
    constraint ck_media_assets_dimensions check (width > 0 and height > 0)
);

create index idx_media_assets_created_at on media_assets (created_at desc);
