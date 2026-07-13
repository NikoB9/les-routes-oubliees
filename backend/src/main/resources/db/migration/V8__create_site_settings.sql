create table site_settings (
    id uuid primary key,
    site_name varchar(120) not null,
    subtitle varchar(180),
    logo_path varchar(255),
    timezone varchar(80) not null,
    status varchar(32) not null,
    maintenance_message varchar(500),
    accessibility_information_markdown text not null,
    updated_by varchar(320),
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint ck_site_settings_status check (status in ('ONLINE', 'MAINTENANCE')),
    constraint ck_site_settings_maintenance_message check (status <> 'MAINTENANCE' or maintenance_message is not null)
);

insert into site_settings (
    id,
    site_name,
    subtitle,
    logo_path,
    timezone,
    status,
    maintenance_message,
    accessibility_information_markdown,
    updated_by,
    created_at,
    updated_at
) values (
    '60000000-0000-0000-0000-000000000001',
    'Les Routes Oubliées',
    'Compagnie d''Arkhavel',
    '/assets/brand/logo-compagnie-des-routes-oubliees.png?v=12fa08d',
    'Europe/Paris',
    'ONLINE',
    null,
    'Les informations d''accessibilité détaillées seront publiées avant la mise en production.',
    null,
    now(),
    now()
);
