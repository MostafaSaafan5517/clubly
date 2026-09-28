-- Home for helper functions that RLS policies call (for example "is this user staff of this
-- business?"). The Supabase API only serves the schemas listed under [api] in config.toml
-- (public, graphql_public), so nothing in `private` can be called over HTTP.
create schema private;

-- Postgres lets every role (PUBLIC, which includes anon) execute any new function by default.
-- Turn that off for functions our migrations create, so every grant has to be deliberate.
-- This must be the global form: a per-schema REVOKE cannot remove a global default.
alter default privileges revoke execute on functions from public;
