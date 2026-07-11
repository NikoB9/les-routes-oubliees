insert into home_messages (
    id, title, content_markdown, importance, status, active, countdown_enabled,
    ends_at, expired_message, last_modified_by, created_at, updated_at
) values (
    '10000000-0000-0000-0000-000000000001',
    'Message de demonstration',
    'La Compagnie se rassemble et prepare sa prochaine etape.',
    'INFORMATION',
    'PUBLISHED',
    true,
    false,
    null,
    null,
    null,
    now(),
    now()
);

insert into company_profiles (
    id, name, emblem_path, image_alt, short_description, long_description_markdown,
    active, created_at, updated_at
) values (
    '20000000-0000-0000-0000-000000000001',
    'Compagnie de demonstration',
    null,
    null,
    'Un groupe fictif cree pour valider les donnees publiques.',
    'Cette presentation de demonstration sera remplacee depuis l''administration.',
    true,
    now(),
    now()
);

insert into adventurers (
    id, name, title, avatar_path, avatar_alt, short_description, strengths,
    weaknesses, visible, display_order, created_at, updated_at
) values
(
    '30000000-0000-0000-0000-000000000001',
    'Aline des Brumes',
    'Eclaireuse',
    null,
    null,
    'Aline ouvre la marche dans les passages incertains.',
    'Observation, discretion',
    'Impatience face aux longs debats',
    true,
    1,
    now(),
    now()
),
(
    '30000000-0000-0000-0000-000000000002',
    'Malo Fer-de-Clef',
    'Cartographe',
    null,
    null,
    'Malo consigne les indices et compare les chemins.',
    'Memoire, deduction',
    'Mefiance excessive',
    true,
    2,
    now(),
    now()
),
(
    '30000000-0000-0000-0000-000000000003',
    'Personnage masque',
    'Invite temporaire',
    null,
    null,
    'Cette carte reste masquee dans les endpoints publics.',
    'Test',
    'Test',
    false,
    3,
    now(),
    now()
);

insert into map_visions (
    id, name, description_markdown, asset_path, image_alt, display_order, status,
    active, created_at, updated_at
) values
(
    '40000000-0000-0000-0000-000000000001',
    'Carte voilee',
    'La destination reste dissimulee. Seuls les premiers reperes sont accessibles.',
    '/assets/maps/map-hidden.webp',
    'Carte de demonstration presque entierement dissimulee.',
    1,
    'PUBLISHED',
    true,
    now(),
    now()
),
(
    '40000000-0000-0000-0000-000000000002',
    'Premiere revelation',
    'Une version preparee pour une prochaine publication.',
    '/assets/maps/map-quest-1.webp',
    'Carte de demonstration revelant une premiere zone.',
    2,
    'DRAFT',
    false,
    now(),
    now()
);

insert into quests (
    id, code, title, summary, important_events_markdown, discovered_clues_markdown,
    completed_trials_markdown, extra_content_markdown, status, visible_to_players,
    display_order, created_at, updated_at
) values
(
    '50000000-0000-0000-0000-000000000001',
    'QUEST_1',
    'Premiere quete de demonstration',
    'Une premiere page fictive est visible pour valider le carnet public.',
    'La Compagnie a recu un appel a l''aventure.',
    'Un symbole recurrent apparait sur plusieurs notes.',
    'Les premiers choix ont ete consignes.',
    'Contenu complementaire de demonstration.',
    'PUBLISHED',
    true,
    1,
    now(),
    now()
),
(
    '50000000-0000-0000-0000-000000000002',
    'QUEST_2',
    'Deuxieme quete de demonstration',
    'Cette entree publiee reste visible pour tester l''ordre du carnet.',
    'Une seconde etape a ete preparee.',
    'Un chemin secondaire pourrait etre utile.',
    'Une enigme simple a ete resolue.',
    'Notes supplementaires fictives.',
    'PUBLISHED',
    true,
    2,
    now(),
    now()
),
(
    '50000000-0000-0000-0000-000000000003',
    'QUEST_3',
    'Troisieme quete brouillon',
    'Cette entree ne doit pas apparaitre publiquement.',
    'Brouillon.',
    'Brouillon.',
    'Brouillon.',
    'Brouillon.',
    'DRAFT',
    false,
    3,
    now(),
    now()
),
(
    '50000000-0000-0000-0000-000000000004',
    'QUEST_4',
    'Quatrieme quete masquee',
    'Cette entree publiee reste masquee aux joueurs.',
    'Texte masque.',
    'Texte masque.',
    'Texte masque.',
    'Texte masque.',
    'PUBLISHED',
    false,
    4,
    now(),
    now()
),
(
    '50000000-0000-0000-0000-000000000005',
    'VAL_D_AURELUNE',
    'Val d''Aurelune archive',
    'Cette entree archivee ne doit pas apparaitre publiquement.',
    'Archive.',
    'Archive.',
    'Archive.',
    'Archive.',
    'ARCHIVED',
    false,
    5,
    now(),
    now()
);
