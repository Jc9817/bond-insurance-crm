# Database (Supabase)

Every change to the database is a numbered file in `migrations/`, applied in
order by the Supabase CLI. Don't paste SQL into the Supabase SQL Editor any more:
a change made there is not in the repo, and a fresh database won't have it.

| Folder / file   | What it is                                                                 |
|-----------------|----------------------------------------------------------------------------|
| `migrations/`   | The schema, in order. `…_baseline.sql` is the live database as of Oct 2026. |
| `config.toml`   | Settings for the local test database (`supabase start`).                   |
| `legacy/`       | The old hand-run SQL files. History only, already part of the baseline. Don't run them. |

The CLI is installed with the project (`npm install`), so use it as `npx supabase …`.
Project ref: `gdzdnrspukzlmgrjnlcs`.

## One-time setup (fix list 2.2)

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/)
running. The CLI uses it to read the live schema and to run a local test database.

```sh
# 1. Log in and link this folder to the live project
#    (asks for the database password: Supabase dashboard -> Project Settings -> Database)
npx supabase login
npx supabase link --project-ref gdzdnrspukzlmgrjnlcs

# 2. Save the live schema as the first migration
npx supabase db dump -f supabase/migrations/20261023000000_baseline.sql

# 3. Tell the live database the baseline is already applied (it came from there)
npx supabase migration repair --status applied 20261023000000

# 4. Apply the Stage 1 + 2.1 migrations to the live database.
#    They are safe to re-run if you already pasted some of them into the SQL Editor.
#    Read the "BEFORE RUNNING" notes at the top of 20261023100000_enable_rls.sql first.
npx supabase db push

# 5. Commit supabase/migrations/20261023000000_baseline.sql
```

## Check: a fresh database runs the app

```sh
npx supabase start      # local Supabase in Docker; prints a local API URL and anon key
npx supabase db reset   # rebuilds the local database from migrations/ only
```

Put the printed local URL and keys in `.env.local` instead of the live ones
(keep a copy of the live values), run `npm run dev`, create a user in the local
Studio (http://127.0.0.1:54323), and click through cases, settings and files.
A missing table or column shows up as an error in the browser console. Run
`npx supabase stop` when you're done.

## Making a change from now on

```sh
npx supabase migration new add_policies_table   # creates migrations/<timestamp>_add_policies_table.sql
# write the SQL in that file, then test it locally:
npx supabase db reset
# when it works, apply it to the live database:
npx supabase db push
```

Commit the migration together with the code that needs it.
