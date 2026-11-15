-- =====================================================================
-- NYC Pickup Soccer System
-- CS-GY 6083 Course Project, Part 3: Sample data
-- DBMS: PostgreSQL 17
--
-- Run after schema.sql (./reset.sh runs both):
--     psql -d nyc_fields -f seed.sql
--
-- This is the Part 2 data (part2/insert_data.sql) unchanged, plus
-- sample GameRating rows (Part 3) near the end.
--
-- Contents
--   24 users: 2 admins, 5 organizers, 17 players
--   12 public soccer fields in real NYC parks, across all five boroughs
--   operating hours for every field, 3 field closures
--   24 pickup games, each on its own field booking (game N uses booking N):
--      6 completed, 9 upcoming with an approved field,
--      4 upcoming waiting on field approval, 5 cancelled
--   147 player sign-ups
--   17 ratings of completed games
-- Dates are relative to 2026-11-09.
--
-- Field names, addresses and surfaces are hand-entered approximations
-- of NYC Parks facilities. People and games are made up.
--
-- The script is re-runnable: it empties all tables first.
-- IDs are given explicitly so foreign keys are easy to follow; the
-- identity sequences are moved past them at the end.
-- =====================================================================

BEGIN;

TRUNCATE GameRating, GameRegistration, PickupGame, Reservation, FieldClosure,
         FieldOperatingHours, Field, Users RESTART IDENTITY CASCADE;


-- ---------------------------------------------------------------------
-- Users
-- Passwords are stored as md5 hashes, matching the login check in the
-- course's Part 3 spec (password = md5(input)).
-- ---------------------------------------------------------------------
INSERT INTO Users (user_id, name, email, password_hash, role) VALUES
    ( 1, 'Maria Lopez',       'maria.lopez@example.com',        md5('maria123'), 'admin'),
    ( 2, 'David Chen',        'david.chen@example.com',         md5('david123'), 'admin'),
    ( 3, 'Kwame Mensah',      'kwame.mensah@example.com',       md5('kwame123'), 'organizer'),
    ( 4, 'Sofia Rossi',       'sofia.rossi@example.com',        md5('sofia123'), 'organizer'),
    ( 5, 'Daniel Park',       'daniel.park@example.com',        md5('daniel123'), 'organizer'),
    ( 6, 'Aisha Rahman',      'aisha.rahman@example.com',       md5('aisha123'), 'organizer'),
    ( 7, 'Tomas Rivera',      'tomas.rivera@example.com',       md5('tomas123'), 'organizer'),
    ( 8, 'Liam O''Brien',     'liam.obrien@example.com',        md5('liam123'), 'player'),
    ( 9, 'Priya Nair',        'priya.nair@example.com',         md5('priya123'), 'player'),
    (10, 'Carlos Mendez',     'carlos.mendez@example.com',      md5('carlos123'), 'player'),
    (11, 'Emma Johansson',    'emma.johansson@example.com',     md5('emma123'), 'player'),
    (12, 'Yusuf Ali',         'yusuf.ali@example.com',          md5('yusuf123'), 'player'),
    (13, 'Grace Kim',         'grace.kim@example.com',          md5('grace123'), 'player'),
    (14, 'Mateo Garcia',      'mateo.garcia@example.com',       md5('mateo123'), 'player'),
    (15, 'Hannah Weiss',      'hannah.weiss@example.com',       md5('hannah123'), 'player'),
    (16, 'Omar Haddad',       'omar.haddad@example.com',        md5('omar123'), 'player'),
    (17, 'Chloe Martin',      'chloe.martin@example.com',       md5('chloe123'), 'player'),
    (18, 'Kofi Boateng',      'kofi.boateng@example.com',       md5('kofi123'), 'player'),
    (19, 'Isabella Romano',   'isabella.romano@example.com',    md5('isabella123'), 'player'),
    (20, 'Arjun Mehta',       'arjun.mehta@example.com',        md5('arjun123'), 'player'),
    (21, 'Fatima Diallo',     'fatima.diallo@example.com',      md5('fatima123'), 'player'),
    (22, 'Lucas Silva',       'lucas.silva@example.com',        md5('lucas123'), 'player'),
    (23, 'Mei Tanaka',        'mei.tanaka@example.com',         md5('mei123'), 'player'),
    (24, 'Noah Goldberg',     'noah.goldberg@example.com',      md5('noah123'), 'player');

-- ---------------------------------------------------------------------
-- Field
-- ---------------------------------------------------------------------
INSERT INTO Field (field_id, name, borough, location, surface_type) VALUES
    ( 1, 'Randall''s Island Field 10',             'Manhattan',     'Randall''s Island Park, New York, NY 10035',                  'Synthetic Turf'),
    ( 2, 'Central Park North Meadow Field 5',      'Manhattan',     'North Meadow, Central Park (E 97th St Transverse)',           'Natural Grass'),
    ( 3, 'Thomas Jefferson Park Soccer Field',     'Manhattan',     'Thomas Jefferson Park, E 112th St & 1st Ave',                 'Synthetic Turf'),
    ( 4, 'Parade Ground Field 3',                  'Brooklyn',      'Prospect Park Parade Ground, Caton Ave & Coney Island Ave',   'Synthetic Turf'),
    ( 5, 'Red Hook Recreation Area Field 7',       'Brooklyn',      'Red Hook Recreation Area, Bay St & Henry St',                 'Synthetic Turf'),
    ( 6, 'McCarren Park Soccer Field',             'Brooklyn',      'McCarren Park, Bedford Ave & N 12th St',                      'Synthetic Turf'),
    ( 7, 'Flushing Meadows Corona Park Field 4',   'Queens',        'Flushing Meadows Corona Park, near Meadow Lake',              'Natural Grass'),
    ( 8, 'Juniper Valley Park Field 2',            'Queens',        'Juniper Valley Park, Juniper Blvd N & 80th St',               'Synthetic Turf'),
    ( 9, 'Van Cortlandt Park Parade Ground 1',     'Bronx',         'Van Cortlandt Park, Broadway & W 242nd St',                   'Natural Grass'),
    (10, 'Macombs Dam Park Soccer Field',          'Bronx',         'Macombs Dam Park, E 161st St & Jerome Ave',                   'Synthetic Turf'),
    (11, 'Pelham Bay Park Field 3',                'Bronx',         'Pelham Bay Park, Bruckner Blvd & Middletown Rd',              'Natural Grass'),
    (12, 'Clove Lakes Park Field 1',               'Staten Island', 'Clove Lakes Park, Victory Blvd & Clove Rd',                   'Natural Grass');

-- ---------------------------------------------------------------------
-- FieldOperatingHours  (day_of_week: 0 = Sunday ... 6 = Saturday)
-- Lit synthetic-turf fields: open every day, 07:00-22:00.
-- Unlit grass fields: 08:00-17:00, closed Mondays (day 1) for upkeep,
-- so they have no Monday row.
-- ---------------------------------------------------------------------
INSERT INTO FieldOperatingHours (field_id, day_of_week, open_time, close_time)
SELECT f.field_id, d.day_of_week, TIME '07:00', TIME '22:00'
FROM Field f
CROSS JOIN generate_series(0, 6) AS d(day_of_week)
WHERE f.surface_type = 'Synthetic Turf';

INSERT INTO FieldOperatingHours (field_id, day_of_week, open_time, close_time)
SELECT f.field_id, d.day_of_week, TIME '08:00', TIME '17:00'
FROM Field f
CROSS JOIN generate_series(0, 6) AS d(day_of_week)
WHERE f.surface_type = 'Natural Grass'
  AND d.day_of_week <> 1;

-- ---------------------------------------------------------------------
-- FieldClosure  (recorded by admins; no game can be approved during one)
-- ---------------------------------------------------------------------
INSERT INTO FieldClosure (closure_id, field_id, start_time, end_time, reason, created_by) VALUES
    (1,  7, '2026-10-20 00:00', '2026-10-23 00:00', 'Drainage repair',                    1),
    (2,  2, '2026-11-16 00:00', '2026-12-01 00:00', 'Lawn reseeding',                     1),
    (3, 10, '2026-11-21 07:00', '2026-11-21 22:00', 'Youth league tournament (all day)',  2);

-- ---------------------------------------------------------------------
-- Reservation: the field booking behind each pickup game
-- Every booking is made by the game's organizer and falls inside the
-- field's operating hours.
-- ---------------------------------------------------------------------
INSERT INTO Reservation (reservation_id, user_id, field_id, start_time, end_time, status,
                         requested_at, reviewed_by, reviewed_at, rejection_reason) VALUES
    -- Past games
    ( 1, 3,  4, '2026-10-17 10:00', '2026-10-17 12:00', 'approved',  '2026-10-05 09:15', 1,    '2026-10-06 11:00', NULL),
    ( 2, 4,  1, '2026-10-25 14:00', '2026-10-25 16:00', 'approved',  '2026-10-12 18:30', 2,    '2026-10-13 10:20', NULL),
    ( 3, 6,  7, '2026-10-21 15:00', '2026-10-21 17:00', 'rejected',  '2026-10-10 14:05', 1,    '2026-10-11 09:40', 'Field closed for drainage repair (Oct 20-22)'),  -- booking rejected: field closure 1
    ( 4, 5,  9, '2026-10-31 09:00', '2026-10-31 11:00', 'cancelled', '2026-10-15 20:10', 2,    '2026-10-16 08:55', NULL),  -- called off by the organizer (rain forecast)
    ( 5, 3, 10, '2026-11-03 19:00', '2026-11-03 21:00', 'approved',  '2026-10-20 12:00', 1,    '2026-10-21 10:15', NULL),
    ( 6, 7,  8, '2026-10-22 18:00', '2026-10-22 20:00', 'approved',  '2026-10-12 16:45', 1,    '2026-10-13 09:05', NULL),
    ( 7, 4,  5, '2026-10-24 09:00', '2026-10-24 11:00', 'approved',  '2026-10-10 11:30', 2,    '2026-10-11 13:00', NULL),
    ( 8, 6,  6, '2026-11-08 10:00', '2026-11-08 12:00', 'approved',  '2026-10-26 19:00', 2,    '2026-10-27 10:30', NULL),
    -- Upcoming games, field approved
    ( 9, 3,  4, '2026-11-14 10:00', '2026-11-14 12:00', 'approved',  '2026-11-01 10:00', 1,    '2026-11-02 09:30', NULL),
    (10, 4,  1, '2026-11-15 14:00', '2026-11-15 16:00', 'approved',  '2026-11-02 12:00', 2,    '2026-11-03 11:10', NULL),
    (11, 5,  8, '2026-11-18 19:00', '2026-11-18 21:00', 'approved',  '2026-11-04 17:20', 1,    '2026-11-05 10:00', NULL),
    (12, 3,  6, '2026-11-21 09:00', '2026-11-21 11:00', 'approved',  '2026-11-05 08:45', 2,    '2026-11-06 12:30', NULL),
    (13, 6,  6, '2026-11-21 11:00', '2026-11-21 13:00', 'approved',  '2026-11-06 10:25', 2,    '2026-11-07 09:45', NULL),
    (14, 7, 10, '2026-11-12 19:00', '2026-11-12 20:30', 'approved',  '2026-11-03 21:30', 1,    '2026-11-04 08:50', NULL),
    (15, 5,  5, '2026-11-22 08:00', '2026-11-22 10:00', 'approved',  '2026-11-06 19:00', 1,    '2026-11-07 09:15', NULL),
    (16, 4,  4, '2026-11-29 16:00', '2026-11-29 18:00', 'approved',  '2026-11-07 13:40', 1,    '2026-11-08 10:05', NULL),
    (17, 3,  9, '2026-12-12 09:00', '2026-12-12 11:00', 'approved',  '2026-11-08 15:00', 2,    '2026-11-09 09:00', NULL),
    -- Upcoming games, field approval pending
    (18, 7,  4, '2026-11-14 11:00', '2026-11-14 13:00', 'pending',   '2026-11-07 20:15', NULL, NULL,               NULL),  -- overlaps game 9's approved booking, so it cannot be approved
    (19, 4,  3, '2026-11-20 18:00', '2026-11-20 20:00', 'pending',   '2026-11-08 09:00', NULL, NULL,               NULL),
    (20, 6, 11, '2026-11-29 10:00', '2026-11-29 12:00', 'pending',   '2026-11-08 18:30', NULL, NULL,               NULL),
    (21, 5, 12, '2026-12-05 10:00', '2026-12-05 13:00', 'pending',   '2026-11-09 08:30', NULL, NULL,               NULL),
    -- Upcoming games that were cancelled
    (22, 7,  2, '2026-11-21 10:00', '2026-11-21 12:00', 'rejected',  '2026-11-03 18:00', 1,    '2026-11-04 09:20', 'Field closed for lawn reseeding (Nov 16-30)'),  -- booking rejected: field closure 2
    (23, 4, 10, '2026-11-21 12:00', '2026-11-21 14:00', 'rejected',  '2026-11-05 14:30', 2,    '2026-11-06 10:40', 'Field reserved for a youth league tournament'),  -- booking rejected: field closure 3
    (24, 5,  7, '2026-11-28 13:00', '2026-11-28 15:00', 'cancelled', '2026-11-02 11:00', NULL, NULL,               NULL);  -- withdrawn by the organizer before review

-- ---------------------------------------------------------------------
-- PickupGame  (game N is hosted on booking N, by that booking's organizer)
-- ---------------------------------------------------------------------
INSERT INTO PickupGame (game_id, organizer_id, reservation_id, format, skill_level, max_players, status) VALUES
    ( 1, 3,  1, '7v7',   'intermediate', 16, 'completed'),
    ( 2, 4,  2, '5v5',   'beginner',     12, 'completed'),
    ( 3, 6,  3, '6v6',   'all levels',   14, 'cancelled'),  -- booking rejected: field closure 1
    ( 4, 5,  4, '9v9',   'all levels',   20, 'cancelled'),  -- called off by the organizer (rain forecast)
    ( 5, 3,  5, '5v5',   'advanced',     10, 'completed'),  -- played full
    ( 6, 7,  6, '6v6',   'intermediate', 14, 'completed'),
    ( 7, 4,  7, '7v7',   'all levels',   18, 'completed'),
    ( 8, 6,  8, '8v8',   'intermediate', 18, 'completed'),
    ( 9, 3,  9, '7v7',   'intermediate', 16, 'scheduled'),
    (10, 4, 10, '5v5',   'beginner',     10, 'scheduled'),  -- full
    (11, 5, 11, '6v6',   'all levels',   14, 'scheduled'),
    (12, 3, 12, '11v11', 'advanced',     24, 'scheduled'),
    (13, 6, 13, '7v7',   'beginner',     16, 'scheduled'),  -- starts as game 12 ends: back-to-back is allowed
    (14, 7, 14, '5v5',   'intermediate', 12, 'scheduled'),
    (15, 5, 15, '7v7',   'advanced',     16, 'scheduled'),
    (16, 4, 16, '8v8',   'all levels',   20, 'scheduled'),
    (17, 3, 17, '9v9',   'intermediate', 20, 'scheduled'),
    (18, 7, 18, '5v5',   'all levels',   12, 'scheduled'),  -- overlaps game 9's approved booking, so it cannot be approved
    (19, 4, 19, '6v6',   'intermediate', 14, 'scheduled'),
    (20, 6, 20, '7v7',   'beginner',     16, 'scheduled'),
    (21, 5, 21, '9v9',   'all levels',   22, 'scheduled'),
    (22, 7, 22, '7v7',   'intermediate', 16, 'cancelled'),  -- booking rejected: field closure 2
    (23, 4, 23, '5v5',   'beginner',     10, 'cancelled'),  -- booking rejected: field closure 3
    (24, 5, 24, '6v6',   'all levels',   14, 'cancelled');  -- withdrawn by the organizer before review

-- ---------------------------------------------------------------------
-- GameRegistration: player sign-ups
-- 'cancelled' means the player left the game, or the game was called
-- off. Games 5 and 10 are full. Organizers can join other people's games.
-- ---------------------------------------------------------------------
INSERT INTO GameRegistration (game_id, user_id, joined_at, registration_status) VALUES
    -- Game 1 (completed, 2026-10-17 10:00): 12 of 16 spots taken
    ( 1, 15, '2026-10-05 14:50', 'registered'),
    ( 1,  7, '2026-10-06 21:40', 'cancelled'),
    ( 1, 11, '2026-10-07 12:45', 'registered'),
    ( 1,  9, '2026-10-08 11:10', 'registered'),
    ( 1, 17, '2026-10-09 13:15', 'registered'),
    ( 1, 22, '2026-10-10 10:00', 'registered'),
    ( 1, 14, '2026-10-10 17:30', 'registered'),
    ( 1, 12, '2026-10-11 09:45', 'registered'),
    ( 1, 13, '2026-10-12 23:30', 'registered'),
    ( 1, 20, '2026-10-13 14:40', 'registered'),
    ( 1, 18, '2026-10-15 11:40', 'registered'),
    ( 1, 19, '2026-10-15 21:15', 'registered'),
    ( 1, 24, '2026-10-16 21:25', 'registered'),
    -- Game 2 (completed, 2026-10-25 14:00): 10 of 12 spots taken
    ( 2,  7, '2026-10-13 07:45', 'registered'),
    ( 2,  9, '2026-10-14 19:40', 'registered'),
    ( 2, 21, '2026-10-15 11:05', 'registered'),
    ( 2, 15, '2026-10-15 18:20', 'registered'),
    ( 2, 16, '2026-10-15 22:10', 'registered'),
    ( 2, 10, '2026-10-20 08:25', 'registered'),
    ( 2, 13, '2026-10-22 22:55', 'registered'),
    ( 2, 11, '2026-10-23 08:10', 'registered'),
    ( 2,  5, '2026-10-24 10:45', 'registered'),
    ( 2, 14, '2026-10-24 20:35', 'registered'),
    -- Game 3 (cancelled, 2026-10-21 15:00): 4 sign-ups, all cancelled with the game
    ( 3, 21, '2026-10-10 16:05', 'cancelled'),
    ( 3, 23, '2026-10-10 19:00', 'cancelled'),
    ( 3,  9, '2026-10-10 22:45', 'cancelled'),
    ( 3, 10, '2026-10-10 23:00', 'cancelled'),
    -- Game 4 (cancelled, 2026-10-31 09:00): 6 sign-ups, all cancelled with the game
    ( 4, 19, '2026-10-17 23:05', 'cancelled'),
    ( 4, 18, '2026-10-18 09:55', 'cancelled'),
    ( 4, 23, '2026-10-18 18:40', 'cancelled'),
    ( 4,  9, '2026-10-19 11:35', 'cancelled'),
    ( 4,  3, '2026-10-19 14:15', 'cancelled'),
    ( 4, 20, '2026-10-28 20:30', 'cancelled'),
    -- Game 5 (completed, 2026-11-03 19:00): 10 of 10 spots taken
    ( 5, 12, '2026-10-22 23:15', 'registered'),
    ( 5,  6, '2026-10-25 18:25', 'cancelled'),
    ( 5,  9, '2026-10-26 21:20', 'registered'),
    ( 5, 18, '2026-10-27 22:45', 'registered'),
    ( 5, 15, '2026-10-28 18:40', 'registered'),
    ( 5, 23, '2026-10-29 13:00', 'registered'),
    ( 5, 14, '2026-10-31 11:55', 'registered'),
    ( 5, 13, '2026-10-31 22:40', 'registered'),
    ( 5,  8, '2026-11-01 15:00', 'registered'),
    ( 5, 17, '2026-11-02 07:15', 'registered'),
    ( 5, 10, '2026-11-02 21:50', 'registered'),
    -- Game 6 (completed, 2026-10-22 18:00): 9 of 14 spots taken
    ( 6, 19, '2026-10-13 08:40', 'registered'),
    ( 6, 13, '2026-10-14 23:00', 'registered'),
    ( 6,  8, '2026-10-15 08:10', 'registered'),
    ( 6, 11, '2026-10-15 14:25', 'registered'),
    ( 6,  9, '2026-10-16 23:10', 'registered'),
    ( 6, 23, '2026-10-17 12:35', 'registered'),
    ( 6, 16, '2026-10-18 14:50', 'registered'),
    ( 6, 14, '2026-10-20 16:45', 'registered'),
    ( 6, 20, '2026-10-20 18:50', 'registered'),
    -- Game 7 (completed, 2026-10-24 09:00): 13 of 18 spots taken
    ( 7, 21, '2026-10-11 10:50', 'registered'),
    ( 7,  8, '2026-10-11 21:20', 'cancelled'),
    ( 7, 17, '2026-10-12 07:05', 'registered'),
    ( 7, 19, '2026-10-12 08:05', 'registered'),
    ( 7, 14, '2026-10-13 08:30', 'registered'),
    ( 7, 22, '2026-10-13 21:40', 'registered'),
    ( 7, 20, '2026-10-15 11:10', 'registered'),
    ( 7, 16, '2026-10-16 10:30', 'registered'),
    ( 7, 15, '2026-10-18 08:45', 'registered'),
    ( 7, 13, '2026-10-18 21:10', 'registered'),
    ( 7,  7, '2026-10-19 22:55', 'registered'),
    ( 7, 24, '2026-10-20 13:05', 'registered'),
    ( 7, 12, '2026-10-20 18:55', 'registered'),
    ( 7, 10, '2026-10-22 13:25', 'registered'),
    -- Game 8 (completed, 2026-11-08 10:00): 14 of 18 spots taken
    ( 8, 10, '2026-10-27 20:35', 'registered'),
    ( 8, 13, '2026-10-29 12:25', 'registered'),
    ( 8, 22, '2026-10-29 20:15', 'registered'),
    ( 8, 11, '2026-10-30 08:45', 'registered'),
    ( 8, 17, '2026-11-01 22:10', 'registered'),
    ( 8, 18, '2026-11-02 15:05', 'registered'),
    ( 8,  3, '2026-11-03 11:25', 'registered'),
    ( 8,  9, '2026-11-03 14:35', 'registered'),
    ( 8,  7, '2026-11-04 21:10', 'registered'),
    ( 8, 16, '2026-11-05 11:00', 'registered'),
    ( 8, 24, '2026-11-06 08:00', 'registered'),
    ( 8, 21, '2026-11-06 09:10', 'registered'),
    ( 8,  8, '2026-11-06 22:40', 'registered'),
    ( 8, 12, '2026-11-07 20:50', 'registered'),
    -- Game 9 (scheduled, 2026-11-14 10:00): 9 of 16 spots taken
    ( 9, 19, '2026-11-01 12:10', 'registered'),
    ( 9,  9, '2026-11-01 19:30', 'cancelled'),
    ( 9, 14, '2026-11-01 23:40', 'registered'),
    ( 9,  8, '2026-11-04 15:55', 'registered'),
    ( 9, 12, '2026-11-05 15:20', 'registered'),
    ( 9, 18, '2026-11-06 12:00', 'registered'),
    ( 9, 22, '2026-11-06 16:20', 'registered'),
    ( 9, 10, '2026-11-08 07:55', 'registered'),
    ( 9, 11, '2026-11-08 16:50', 'registered'),
    ( 9,  4, '2026-11-08 21:30', 'registered'),
    -- Game 10 (scheduled, 2026-11-15 14:00): 10 of 10 spots taken
    (10, 15, '2026-11-02 17:15', 'registered'),
    (10, 22, '2026-11-04 10:45', 'cancelled'),
    (10, 12, '2026-11-04 10:50', 'registered'),
    (10, 13, '2026-11-04 11:00', 'registered'),
    (10, 14, '2026-11-04 12:50', 'registered'),
    (10, 17, '2026-11-04 14:45', 'registered'),
    (10,  3, '2026-11-05 10:00', 'registered'),
    (10, 10, '2026-11-05 19:05', 'registered'),
    (10, 20, '2026-11-06 21:20', 'registered'),
    (10,  9, '2026-11-06 22:10', 'registered'),
    (10,  5, '2026-11-08 14:30', 'registered'),
    -- Game 11 (scheduled, 2026-11-18 19:00): 6 of 14 spots taken
    (11, 12, '2026-11-06 10:15', 'registered'),
    (11, 16, '2026-11-06 15:35', 'registered'),
    (11, 14, '2026-11-07 20:15', 'registered'),
    (11, 22, '2026-11-07 20:50', 'registered'),
    (11, 21, '2026-11-08 08:30', 'registered'),
    (11, 15, '2026-11-08 16:15', 'registered'),
    -- Game 12 (scheduled, 2026-11-21 09:00): 8 of 24 spots taken
    (12, 19, '2026-11-05 12:30', 'registered'),
    (12, 10, '2026-11-05 12:30', 'cancelled'),
    (12, 21, '2026-11-05 14:50', 'registered'),
    (12, 18, '2026-11-05 15:10', 'registered'),
    (12,  9, '2026-11-05 19:30', 'registered'),
    (12, 24, '2026-11-05 20:00', 'registered'),
    (12,  8, '2026-11-06 09:10', 'registered'),
    (12, 14, '2026-11-07 12:30', 'registered'),
    (12, 13, '2026-11-07 18:30', 'registered'),
    -- Game 13 (scheduled, 2026-11-21 11:00): 5 of 16 spots taken
    (13, 15, '2026-11-07 22:45', 'registered'),
    (13, 19, '2026-11-08 09:40', 'registered'),
    (13,  9, '2026-11-08 13:25', 'registered'),
    (13, 12, '2026-11-08 17:00', 'registered'),
    (13, 13, '2026-11-08 22:25', 'registered'),
    -- Game 14 (scheduled, 2026-11-12 19:00): 7 of 12 spots taken
    (14,  8, '2026-11-05 19:25', 'registered'),
    (14,  9, '2026-11-05 22:50', 'registered'),
    (14, 10, '2026-11-07 08:10', 'registered'),
    (14, 15, '2026-11-07 12:50', 'registered'),
    (14, 20, '2026-11-07 15:50', 'registered'),
    (14,  6, '2026-11-08 12:00', 'registered'),
    (14, 13, '2026-11-08 18:10', 'registered'),
    -- Game 15 (scheduled, 2026-11-22 08:00): 4 of 16 spots taken
    (15, 13, '2026-11-06 21:45', 'registered'),
    (15, 10, '2026-11-07 16:30', 'registered'),
    (15, 16, '2026-11-08 09:20', 'registered'),
    (15, 12, '2026-11-09 07:50', 'registered'),
    -- Game 16 (scheduled, 2026-11-29 16:00): 3 of 20 spots taken
    (16,  6, '2026-11-07 20:05', 'registered'),
    (16, 14, '2026-11-08 17:15', 'registered'),
    (16, 16, '2026-11-09 07:50', 'registered'),
    -- Game 17 (scheduled, 2026-12-12 09:00): 2 of 20 spots taken
    (17, 21, '2026-11-08 22:10', 'registered'),
    (17, 23, '2026-11-09 11:45', 'registered'),
    -- Game 18 (scheduled, 2026-11-14 11:00): 2 of 12 spots taken
    (18, 16, '2026-11-08 13:10', 'registered'),
    (18, 23, '2026-11-09 07:55', 'registered'),
    -- Game 19 (scheduled, 2026-11-20 18:00): 3 of 14 spots taken
    (19,  5, '2026-11-09 07:40', 'registered'),
    (19, 18, '2026-11-09 08:20', 'registered'),
    (19,  9, '2026-11-09 09:50', 'registered'),
    -- Game 20 (scheduled, 2026-11-29 10:00): 1 of 16 spots taken
    (20,  8, '2026-11-09 11:50', 'registered'),
    -- Game 22 (cancelled, 2026-11-21 10:00): 2 sign-ups, all cancelled with the game
    (22, 22, '2026-11-03 22:15', 'cancelled'),
    (22, 23, '2026-11-03 23:30', 'cancelled'),
    -- Game 23 (cancelled, 2026-11-21 12:00): 1 sign-ups, all cancelled with the game
    (23, 14, '2026-11-05 16:45', 'cancelled');

-- ---------------------------------------------------------------------
-- GameRating (Part 3): ratings of the six completed games, each by a
-- player whose sign-up for that game was not cancelled, given after
-- the game was played. Comments are optional (NULL = stars only).
-- ---------------------------------------------------------------------
INSERT INTO GameRating (game_id, user_id, rating, comment, rated_at) VALUES
    -- Game 1: Parade Ground Field 3, 2026-10-17, organized by Kwame Mensah
    (1, 15, 5, 'Great run, evenly matched teams.',            '2026-10-17 14:10'),
    (1,  9, 4, 'Good game. Kickoff was a bit late.',          '2026-10-18 09:30'),
    (1, 13, 5, NULL,                                          '2026-10-18 12:00'),
    (1, 22, 3, 'Too many subs waiting on the sideline.',      '2026-10-18 20:00'),
    -- Game 2: Randall's Island Field 10, 2026-10-25, organized by Sofia Rossi
    (2,  9, 5, 'Perfect for beginners, very welcoming.',      '2026-10-25 18:20'),
    (2, 21, 4, 'Fun, would come again.',                      '2026-10-26 10:05'),
    (2, 10, 4, NULL,                                          '2026-10-27 12:00'),
    -- Game 5: Macombs Dam Park, 2026-11-03, organized by Kwame Mensah
    (5, 12, 5, 'Fast and competitive, exactly as advertised.', '2026-11-03 22:30'),
    (5, 23, 3, 'Half the field lights went out early.',       '2026-11-04 08:15'),
    (5, 13, 4, 'Solid level of play.',                        '2026-11-04 19:00'),
    -- Game 6: Juniper Valley Park Field 2, 2026-10-22, organized by Tomas Rivera
    (6, 19, 4, 'Nice field, friendly group.',                 '2026-10-23 08:40'),
    (6, 16, 2, 'Organizer showed up 20 minutes late.',        '2026-10-23 11:10'),
    -- Game 7: Red Hook Recreation Area Field 7, 2026-10-24, organized by Sofia Rossi
    (7, 17, 5, 'Best pickup game I have played this fall.',   '2026-10-24 13:00'),
    (7, 24, 4, 'Good mix of skill levels.',                   '2026-10-25 09:45'),
    -- Game 8: McCarren Park Soccer Field, 2026-11-08, organized by Aisha Rahman
    (8, 11, 4, 'Well organized and started on time.',         '2026-11-08 14:00'),
    (8, 18, 5, NULL,                                          '2026-11-08 16:30'),
    (8,  8, 3, 'Another group was crowding the field.',       '2026-11-09 10:15');

-- ---------------------------------------------------------------------
-- Move each identity sequence past the explicit IDs used above, so the
-- application's next INSERT gets a fresh ID instead of a duplicate.
-- ---------------------------------------------------------------------
SELECT setval(pg_get_serial_sequence('users',        'user_id'),        (SELECT MAX(user_id)        FROM Users));
SELECT setval(pg_get_serial_sequence('field',        'field_id'),       (SELECT MAX(field_id)       FROM Field));
SELECT setval(pg_get_serial_sequence('fieldclosure', 'closure_id'),     (SELECT MAX(closure_id)     FROM FieldClosure));
SELECT setval(pg_get_serial_sequence('reservation',  'reservation_id'), (SELECT MAX(reservation_id) FROM Reservation));
SELECT setval(pg_get_serial_sequence('pickupgame',   'game_id'),        (SELECT MAX(game_id)        FROM PickupGame));

COMMIT;
