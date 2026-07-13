update home_messages
set title = 'Message de démonstration',
    content_markdown = 'La Compagnie se rassemble et prépare sa prochaine étape.'
where id = '10000000-0000-0000-0000-000000000001';

update company_profiles
set name = 'Compagnie de démonstration',
    short_description = 'Un groupe fictif créé pour valider les données publiques.',
    long_description_markdown = 'Cette présentation de démonstration sera remplacée depuis l''administration.'
where id = '20000000-0000-0000-0000-000000000001';

update adventurers
set name = 'Personnage masqué',
    title = 'Invité temporaire',
    short_description = 'Cette carte reste masquée dans les endpoints publics.'
where id = '30000000-0000-0000-0000-000000000003';

update map_visions
set name = 'Carte voilée',
    description_markdown = 'La destination reste dissimulée. Seuls les premiers repères sont accessibles.',
    image_alt = 'Carte de démonstration presque entièrement dissimulée.'
where id = '40000000-0000-0000-0000-000000000001';

update map_visions
set name = 'Première révélation',
    image_alt = 'Carte de démonstration révélant une première zone.'
where id = '40000000-0000-0000-0000-000000000002';

update quests
set title = 'Première quête de démonstration',
    summary = 'Une première page fictive est visible pour valider le carnet public.',
    important_events_markdown = 'La Compagnie a reçu un appel à l''aventure.',
    discovered_clues_markdown = 'Un symbole récurrent apparaît sur plusieurs notes.',
    completed_trials_markdown = 'Les premiers choix ont été consignés.',
    extra_content_markdown = 'Contenu complémentaire de démonstration.'
where id = '50000000-0000-0000-0000-000000000001';

update quests
set title = 'Deuxième quête de démonstration',
    summary = 'Cette entrée publiée reste visible pour tester l''ordre du carnet.',
    important_events_markdown = 'Une seconde étape a été préparée.',
    extra_content_markdown = 'Un chemin secondaire pourrait être utile.'
where id = '50000000-0000-0000-0000-000000000002';

update quests
set title = 'Troisième quête brouillon',
    summary = 'Cette entrée ne doit pas apparaître publiquement.'
where id = '50000000-0000-0000-0000-000000000003';

update quests
set title = 'Quatrième quête masquée',
    summary = 'Cette entrée publiée reste masquée aux joueurs.',
    important_events_markdown = 'Texte masqué.',
    discovered_clues_markdown = 'Texte masqué.',
    completed_trials_markdown = 'Texte masqué.',
    extra_content_markdown = 'Texte masqué.'
where id = '50000000-0000-0000-0000-000000000004';

update quests
set summary = 'Cette entrée archivée ne doit pas apparaître publiquement.'
where id = '50000000-0000-0000-0000-000000000005';

update map_markers
set title = 'Marqueur brouillon masqué'
where id = '60000000-0000-0000-0000-000000000003';

update map_markers
set title = 'Marqueur publié masqué'
where id = '60000000-0000-0000-0000-000000000004';

update map_markers
set title = 'Marqueur archivé masqué'
where id = '60000000-0000-0000-0000-000000000005';

update site_settings
set site_name = 'Les Routes Oubliées',
    accessibility_information_markdown = 'Les informations d''accessibilité détaillées seront publiées avant la mise en production.'
where id = '60000000-0000-0000-0000-000000000001';
