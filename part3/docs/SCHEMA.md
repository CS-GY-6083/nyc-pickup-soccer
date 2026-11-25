# Database schema (Part 3)

The tables from Part 2, plus what Part 3 added: the `GameRating` table and `PickupGame.delayed` / `delay_note`. The full definitions, with every constraint, are in [`db/schema.sql`](../db/schema.sql); the same tables are merged back into `part2/create_tables.sql`. GitHub draws the diagram below; for an image file, paste the `mermaid` block into https://mermaid.live and export a PNG.

Not shown: the `GameState` view (each game's state, worked out from `PickupGame` and `Reservation`), and the `session` table that stores logins.

## Relational schema

Primary keys are **bold**; foreign keys are marked → with the table they point to.

- **Users**(**user_id**, name, email, password_hash, role)
- **Field**(**field_id**, name, borough, location, surface_type, latitude, longitude)
- **FieldOperatingHours**(**field_id** → Field, **day_of_week**, open_time, close_time)
- **FieldClosure**(**closure_id**, field_id → Field, start_time, end_time, reason, created_by → Users)
- **Reservation**(**reservation_id**, user_id → Users, field_id → Field, start_time, end_time, status, requested_at, reviewed_by → Users, reviewed_at, rejection_reason)
- **PickupGame**(**game_id**, organizer_id → Users, reservation_id → Reservation (unique), format, skill_level, max_players, status, delayed, delay_note)
- **GameRegistration**(**game_id** → PickupGame, **user_id** → Users, joined_at, registration_status)
- **GameRating**(**game_id**, **user_id**, rating, comment, rated_at), with (game_id, user_id) → GameRegistration

Rules worth knowing:
- Approved bookings of one field can't overlap: an exclusion constraint on `Reservation`.
- A rating needs the player's sign-up (composite foreign key). A trigger also requires that the game was played: booking approved, sign-up not cancelled, game over.
- A delay note exists only while the game is delayed (`chk_game_delay_note`).
- Emails are unique, ignoring capitals.

## Diagram

```mermaid
erDiagram
    Users {
        int user_id PK
        varchar name
        varchar email UK "unique, ignoring capitals"
        varchar password_hash "md5"
        varchar role "player, organizer or admin"
    }
    Field {
        int field_id PK
        varchar name UK
        varchar borough
        varchar location
        varchar surface_type
        numeric latitude
        numeric longitude
    }
    FieldOperatingHours {
        int field_id PK, FK
        smallint day_of_week PK "0 = Sunday"
        time open_time
        time close_time
    }
    FieldClosure {
        int closure_id PK
        int field_id FK
        timestamp start_time
        timestamp end_time
        varchar reason
        int created_by FK "admin"
    }
    Reservation {
        int reservation_id PK
        int user_id FK "organizer"
        int field_id FK
        timestamp start_time
        timestamp end_time
        varchar status "pending, approved, rejected, cancelled"
        timestamp requested_at
        int reviewed_by FK "admin"
        timestamp reviewed_at
        varchar rejection_reason
    }
    PickupGame {
        int game_id PK
        int organizer_id FK
        int reservation_id FK, UK
        varchar format "5v5 to 11v11"
        varchar skill_level
        smallint max_players
        varchar status "scheduled, completed, cancelled"
        boolean delayed "Part 3"
        varchar delay_note "Part 3"
    }
    GameRegistration {
        int game_id PK, FK
        int user_id PK, FK
        timestamp joined_at
        varchar registration_status "registered or cancelled"
    }
    GameRating {
        int game_id PK, FK "Part 3"
        int user_id PK, FK
        smallint rating "1 to 5"
        varchar comment
        timestamp rated_at
    }

    Field ||--o{ FieldOperatingHours : "is open"
    Field ||--o{ FieldClosure : "is closed by"
    Users ||--o{ FieldClosure : "adds"
    Field ||--o{ Reservation : "is booked by"
    Users ||--o{ Reservation : "requests"
    Users |o--o{ Reservation : "reviews"
    Reservation ||--o| PickupGame : "hosts"
    Users ||--o{ PickupGame : "organizes"
    PickupGame ||--o{ GameRegistration : "has sign-ups"
    Users ||--o{ GameRegistration : "signs up"
    GameRegistration ||--o| GameRating : "is rated by"
```
