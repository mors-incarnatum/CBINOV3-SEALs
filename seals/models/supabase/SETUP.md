# Supabase model layer

The migration creates `profiles`, `profile_memberships`, `boards`, `tiles`, and
`profile_settings`. A profile represents an AAC communicator; its owner is a
caregiver's `auth.users` identity. Additional caregivers have `editor` or `viewer`
memberships. Only the owner manages sharing or deletes/renames the profile.

## Apply and configure

1. Apply `migrations/20261117000100_board_models.sql` in your Supabase SQL Editor
   as the database owner. The migration lives under `seals/MODELS/supabase/`;
   copy it into your CLI project's `supabase/migrations/` directory if using
   the Supabase CLI migration workflow. This migration runs once, in a
   transaction; it has not been applied to a hosted project by this change.
2. Copy `.env.example` to `.env.local` and set your project URL and publishable
   key. Never use a service-role or secret key in `NEXT_PUBLIC_*` variables.
3. Authenticate a caregiver using Supabase Auth before invoking the repository.
   Keep the `private` schema out of the Data API's exposed schemas. Keep the API
   maximum row count at least 500 (the repository's page size).

```ts
import { getSupabaseBrowserClient } from "@/MODELS/supabase/client";
import { SupabaseBoardRepository } from "@/MODELS/supabase/boardRepository";

// In a future cloud ViewModel command, after sign-in:
const client = getSupabaseBrowserClient();
if (client) {
    const repository = new SupabaseBoardRepository(client);
    const profile = await repository.createProfile("Communication profile");
    // `localData` is a snapshot of the existing BoardData, obtained by the caller.
    for (const board of Object.values(localData.boards)) {
        await repository.saveBoard(profile.id, board);
    }
    for (const tile of Object.values(localData.tiles)) {
        await repository.saveTile(profile.id, tile);
    }
    await repository.saveSettings(profile.id, localData);
}
```

These calls are independent requests, not an atomic import or a synchronization
engine. Handle rejected promises in the calling ViewModel and keep local data
available on failures. Repeating board/tile/settings upserts is safe, but creating
a profile again creates a different profile. Save its ID before retrying imports.
The app does not automatically call the repository, upload existing local data,
sign users in, or replace Zustand. Account UI, queued sync, conflict resolution,
and cross-device restore remain separate work.

## Data contracts

- Board and tile primary keys are `(profile_id, id)`. Existing local IDs such as
  `home`, `needs`, `n-1`, `cat-*`, and `custom-*` remain unchanged.
- `boards.pages` keeps ordered JSONB pages, sparse `row:col` cells and hidden
  placements. Cells outside the currently selected grid remain stored, up to
  the app's 16 by 16 limit. Empty pages and optional grid overrides round-trip.
- Tiles reference category and folder target boards within the same profile.
  Create boards before tiles. Board deletion requires removing/reassigning its
  tiles and folder references first; deleting a whole profile cascades its data.
- JSONB cell tile IDs and `catalog_order` are application-managed references;
  PostgreSQL validates their layout shape, not their existence. A future atomic
  import/sync operation should validate the complete graph and clean up dangling
  placements when deleting tiles. Never combine rows from different profiles.
- Settings mirror the local grid, appearance, speech and gesture settings.
  `editPin` and the current sentence are device-local and excluded from the
  cloud contract. The edit PIN is a UI convenience, not Supabase authorization.
  On restore, retain local `sentence` and merge cloud `accessConfig` into the
  local access config to retain the device's PIN.
- `MODELS/supabase/database.types.ts` supplies Row/Insert/Update contracts and foreign-key
  relationships. `MODELS/supabase/mappers.ts` validates JSONB and converts snake_case rows
  to the existing domain shapes. After schema changes, regenerate database types
  with the Supabase CLI and update the adapters together.
- The client factory is lazy and returns `null` when configuration is absent.
  It is intended for browser use. Server authentication needs a separate
  request-scoped client; do not reuse this browser singleton on the server.

Policy design follows [Supabase's RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security);
the typed client follows [Supabase TypeScript support](https://supabase.com/docs/reference/javascript/typescript-support).
