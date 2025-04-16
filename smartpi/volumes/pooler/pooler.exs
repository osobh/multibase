alias Supavisor.Config
alias Supavisor.Config.User

Config.set_tenant_id("${POOLER_TENANT_ID}")

user = %User{
  username: "postgres",
  password: "postgres",
  pool_size: "${POOLER_DEFAULT_POOL_SIZE}",
  pool_checkout_timeout: 1000,
  check_query: "select 1",
  max_client_conn: "${POOLER_MAX_CLIENT_CONN}",
  ip_version: 4,
  only_proxies: false,
  admin: true
}

%{cluster_name: "local", host: "db", port: "5432", database: "postgres", maintenance_db: "${POSTGRES_DB}"}
|> Config.ensure_cluster!()
|> Config.ensure_user!(user)