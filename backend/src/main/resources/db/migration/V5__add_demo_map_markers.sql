update map_visions
set asset_path = '/assets/maps/map-hidden.png',
    image_alt = 'Carte illustrée des Routes Oubliées presque entièrement voilée.'
where id = '40000000-0000-0000-0000-000000000001';

update map_visions
set asset_path = '/assets/maps/map-quest-1.png',
    image_alt = 'Carte illustrée des Routes Oubliées révélant une première zone.'
where id = '40000000-0000-0000-0000-000000000002';

insert into map_markers (
    id, quest_id, title, position_x, position_y, active, display_order, created_at, updated_at
) values
(
    '60000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001',
    'Premier appel',
    31.500,
    70.000,
    true,
    1,
    now(),
    now()
),
(
    '60000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000002',
    'Chemin secondaire',
    48.000,
    53.000,
    true,
    2,
    now(),
    now()
),
(
    '60000000-0000-0000-0000-000000000003',
    '50000000-0000-0000-0000-000000000003',
    'Marqueur brouillon masque',
    61.000,
    38.000,
    true,
    3,
    now(),
    now()
),
(
    '60000000-0000-0000-0000-000000000004',
    '50000000-0000-0000-0000-000000000004',
    'Marqueur publie masque',
    72.000,
    31.000,
    true,
    4,
    now(),
    now()
),
(
    '60000000-0000-0000-0000-000000000005',
    '50000000-0000-0000-0000-000000000005',
    'Marqueur archive masque',
    82.000,
    25.000,
    true,
    5,
    now(),
    now()
);
