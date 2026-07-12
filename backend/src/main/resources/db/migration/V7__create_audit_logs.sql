create table audit_logs (
    id uuid primary key,
    actor_email varchar(320),
    action varchar(80) not null,
    entity_type varchar(80) not null,
    entity_id varchar(120),
    summary varchar(500) not null,
    created_at timestamptz not null
);

create index idx_audit_logs_created_at on audit_logs (created_at desc);
create index idx_audit_logs_entity on audit_logs (entity_type, entity_id);
