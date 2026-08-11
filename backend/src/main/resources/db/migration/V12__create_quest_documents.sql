-- Documents d'organisation d'une quete, reserves a l'organisateur.
--
-- Table dediee plutot que reutilisation de `media_assets` : `/media/**` n'exige que ROLE_USER,
-- donc tout aventurier authentifie peut lire un media par son identifiant. Ces documents ne
-- doivent etre atteignables que sous `/api/admin/**`.
--
-- `on delete cascade` supprime les lignes, jamais les fichiers sur disque. Les cinq quetes ne
-- sont jamais supprimees, mais aucun endpoint de suppression de quete ne doit etre ajoute sans
-- balayage du repertoire `quests/` du volume de medias.
--
-- Les deux contraintes d'unicite empechent deux lignes de designer le meme fichier : sans elles,
-- la suppression de l'une detruirait le document de l'autre.
--
-- `uploaded_by` est nullable, comme `media_assets.created_by`, parce que `AdminIdentity.email`
-- rend `null` sans authentification. Le cas ne peut pas survenir sous `/api/admin/**`, mais le
-- schema n'a pas a dependre d'une garantie portee ailleurs.
create table quest_documents (
    id uuid primary key,
    quest_id uuid not null references quests(id) on delete cascade,
    label varchar(160) not null,
    original_filename varchar(255) not null,
    stored_filename varchar(120) not null,
    relative_path varchar(255) not null,
    mime_type varchar(64) not null,
    size_bytes bigint not null,
    uploaded_by varchar(320),
    created_at timestamptz not null,
    constraint uk_quest_documents_relative_path unique (relative_path),
    constraint uk_quest_documents_stored_filename unique (stored_filename),
    constraint ck_quest_documents_mime_type check (mime_type = 'application/pdf'),
    constraint ck_quest_documents_size check (size_bytes > 0)
);

create index idx_quest_documents_quest on quest_documents (quest_id, created_at desc);
