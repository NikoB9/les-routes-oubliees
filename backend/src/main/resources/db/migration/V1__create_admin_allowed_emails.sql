create table admin_allowed_emails (
    id uuid primary key,
    email varchar(320) not null,
    label varchar(120),
    active boolean not null,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint uk_admin_allowed_emails_email unique (email)
);

create index idx_admin_allowed_emails_active on admin_allowed_emails (active);
