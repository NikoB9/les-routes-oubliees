alter table map_markers
    add column label_position varchar(12) not null default 'TOP',
    add column label_offset_px integer not null default 16,
    add constraint ck_map_markers_label_position check (label_position in ('TOP', 'BOTTOM', 'LEFT', 'RIGHT')),
    add constraint ck_map_markers_label_offset_px check (label_offset_px >= 0 and label_offset_px <= 120);
