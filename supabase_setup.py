#!/usr/bin/env python3
"""
Supabase Project Setup Tool

This script creates a new Supabase self-hosted deployment with custom port mappings.
"""

import os
import shutil
import socket
import argparse
import subprocess
import random
import string
from pathlib import Path


class SupabaseProjectGenerator:
    def __init__(self, project_name, base_port=None):
        """Initialize the generator with project name and optional base port."""
        self.project_dir = Path(project_name)
        self.project_name = self.project_dir.name  # Use only the base name for Compose volume names
        self.base_port = base_port
        
        # Calculate ports
        self.ports = self._calculate_ports()
        
        # Create project directory
        self._create_project_directory()
        
        # Templates and content
        self.templates = {}
        self._initialize_templates()

    def run(self):
        """Create project subdirectories and write template files."""
        # Define subdirectories to create
        subdirs = [
            "volumes/api",
            "volumes/db/data",
            "volumes/functions",
            "volumes/logs",
            "volumes/pooler",
            "volumes/storage",
            "volumes/analytics",
            "volumes/db"
        ]

        # Create subdirectories
        for subdir in subdirs:
            dir_path = self.project_dir / subdir
            if dir_path.exists() and not dir_path.is_dir():
                dir_path.unlink()  # Remove file if it exists
            dir_path.mkdir(parents=True, exist_ok=True)

        # Ensure volumes/functions/main is a directory and add a sample function if missing
        main_dir = self.project_dir / "volumes/functions/main"
        if main_dir.exists() and not main_dir.is_dir():
            main_dir.unlink()  # Remove file if it exists
        main_dir.mkdir(parents=True, exist_ok=True)
        sample_function = main_dir / "index.ts"
        if not sample_function.exists():
            sample_function.write_text("""// Sample Supabase Edge Function
import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
serve((_req) => new Response("Hello from Edge Functions!"));
""")

        # Write template files
        (self.project_dir / "docker-compose.yml").write_text(self.templates["docker_compose"])
        (self.project_dir / ".env").write_text(self.templates["env"])
        (self.project_dir / "volumes/api/kong.yml").write_text(self.templates["kong"])
        self._write_vector_config()  # Use the dynamic vector config method
        (self.project_dir / "volumes/pooler/pooler.exs").write_text(self.templates["pooler"])
        (self.project_dir / "volumes/db/_supabase.sql").write_text(self.templates["supabase_sql"])
        (self.project_dir / "volumes/db/logs.sql").write_text(self.templates["logs_sql"])
        (self.project_dir / "volumes/db/jwt.sql").write_text(self.templates["jwt_sql"])
        (self.project_dir / "volumes/db/pooler.sql").write_text(self.templates["pooler_sql"])
        (self.project_dir / "volumes/db/realtime.sql").write_text(self.templates["realtime_sql"])
        (self.project_dir / "volumes/db/roles.sql").write_text(self.templates["roles_sql"])
        (self.project_dir / "volumes/db/webhooks.sql").write_text(self.templates["webhooks_sql"])
        (self.project_dir / "volumes/functions/main").write_text(self.templates["function_main"])
        (self.project_dir / "reset.sh").write_text(self.templates["reset_script"])
        (self.project_dir / "README.md").write_text(self.templates["readme"])
        
    def _write_vector_config(self):
        """Write the vector.yml config with dynamic project/service names."""
        vector_template = self.templates["vector"]
        project_name = self.project_name
        analytics_service = f"{project_name}-analytics"
        kong_service = f"{project_name}-kong"
        
        # Replace placeholders
        vector_config = (
            vector_template
            .replace("__PROJECT__", project_name)
            .replace("__ANALYTICS_SERVICE__", analytics_service)
            .replace("__KONG_SERVICE__", kong_service)
        )
        
        # Write to the project directory
        vector_path = self.project_dir / "volumes/logs/vector.yml"
        vector_path.write_text(vector_config)

    def _create_project_directory(self):
        """Create the project directory if it doesn't exist."""
        if self.project_dir.exists():
            raise FileExistsError(f"Directory {self.project_name} already exists.")
        
        self.project_dir.mkdir(parents=True)
        print(f"Created directory: {self.project_name}")

    def _is_port_available(self, port):
        """Check if a port is available."""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            return s.connect_ex(('localhost', port)) != 0

    def _find_available_port(self, start_port, step=1):
        """Find an available port starting from start_port."""
        port = start_port
        while not self._is_port_available(port):
            port += step
        return port

    def _calculate_ports(self):
        """Calculate all required ports for the Supabase services."""
        if self.base_port is None:
            # Find a random available base port between 3000 and 9000
            self.base_port = self._find_available_port(random.randint(3000, 9000))
        
        ports = {
            "kong_http": self._find_available_port(self.base_port),
            "kong_https": self._find_available_port(self.base_port + 443),
            "postgres": self._find_available_port(self.base_port + 1000),
            "pooler": self._find_available_port(self.base_port + 1001),
            "studio": self._find_available_port(self.base_port + 2000),
            "analytics": self._find_available_port(self.base_port + 3000)
        }
        
        print(f"Using base port: {self.base_port}")
        print(f"Kong HTTP port: {ports['kong_http']}")
        print(f"Kong HTTPS port: {ports['kong_https']}")
        print(f"PostgreSQL port: {ports['postgres']}")
        print(f"Pooler port: {ports['pooler']}")
        print(f"Studio port: {ports['studio']}")
        print(f"Analytics port: {ports['analytics']}")
        
        return ports

    def _initialize_templates(self):
        """Initialize template content for various files."""
        self._init_docker_compose_template()
        self._init_env_template()
        self._init_vector_template()
        self._init_kong_template()
        self._init_pooler_template()
        self._init_db_templates()
        self._init_function_templates()
        self._init_misc_templates()

    def _init_docker_compose_template(self):
        """Initialize docker-compose.yml template."""
        self.templates["docker_compose"] = f"""
name: {self.project_name}

services:
  studio:
    container_name: {self.project_name}-studio
    image: supabase/studio:20250317-6955350
    restart: unless-stopped
    ports:
      - "{self.ports['studio']}:3000"
    environment:
      STUDIO_PG_META_URL: http://meta:8080
      POSTGRES_PASSWORD: ${{POSTGRES_PASSWORD}}
      DEFAULT_ORGANIZATION_NAME: ${{STUDIO_DEFAULT_ORGANIZATION}}
      DEFAULT_PROJECT_NAME: ${{STUDIO_DEFAULT_PROJECT}}
      SUPABASE_URL: http://kong:8000
      SUPABASE_PUBLIC_URL: ${{SUPABASE_PUBLIC_URL}}
      SUPABASE_ANON_KEY: ${{ANON_KEY}}
      SUPABASE_SERVICE_KEY: ${{SERVICE_ROLE_KEY}}
      AUTH_JWT_SECRET: ${{JWT_SECRET}}
      LOGFLARE_API_KEY: ${{LOGFLARE_API_KEY}}
      LOGFLARE_URL: http://analytics:4000
      NEXT_PUBLIC_ENABLE_LOGS: true
      NEXT_ANALYTICS_BACKEND_PROVIDER: postgres
    depends_on:
      analytics:
        condition: service_healthy

  kong:
    container_name: {self.project_name}-kong
    image: kong:2.8.1
    restart: unless-stopped
    ports:
      - "{self.ports['kong_http']}:8000/tcp"
      - "{self.ports['kong_https']}:8443/tcp"
    volumes:
      - ./volumes/api/kong.yml:/home/kong/temp.yml:ro,z
    depends_on:
      analytics:
        condition: service_healthy
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /home/kong/kong.yml
      KONG_DNS_ORDER: LAST,A,CNAME
      KONG_PLUGINS: request-transformer,cors,key-auth,acl,basic-auth
      KONG_NGINX_PROXY_PROXY_BUFFER_SIZE: 160k
      KONG_NGINX_PROXY_PROXY_BUFFERS: 64 160k
      SUPABASE_ANON_KEY: ${{ANON_KEY}}
      SUPABASE_SERVICE_KEY: ${{SERVICE_ROLE_KEY}}
      DASHBOARD_USERNAME: ${{DASHBOARD_USERNAME}}
      DASHBOARD_PASSWORD: ${{DASHBOARD_PASSWORD}}
    entrypoint: bash -c 'eval "echo \\"$$(cat ~/temp.yml)\\"" > ~/kong.yml && /docker-entrypoint.sh kong docker-start'

  auth:
    container_name: {self.project_name}-auth
    image: supabase/gotrue:v2.170.0
    restart: unless-stopped
    healthcheck:
      test:
        [
          "CMD",
          "wget",
          "--no-verbose",
          "--tries=1",
          "--spider",
          "http://localhost:9999/health"
        ]
      timeout: 5s
      interval: 5s
      retries: 3
    depends_on:
      db:
        condition: service_healthy
      analytics:
        condition: service_healthy
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      API_EXTERNAL_URL: ${{API_EXTERNAL_URL}}
      GOTRUE_DB_DRIVER: postgres
      # Use the internal port for PostgreSQL (5432) for container-to-container communication
      GOTRUE_DB_DATABASE_URL: postgres://supabase_auth_admin:${{POSTGRES_PASSWORD}}@${{POSTGRES_HOST}}:5432/${{POSTGRES_DB}}
      GOTRUE_SITE_URL: ${{SITE_URL}}
      GOTRUE_URI_ALLOW_LIST: ${{ADDITIONAL_REDIRECT_URLS}}
      GOTRUE_DISABLE_SIGNUP: ${{DISABLE_SIGNUP}}
      GOTRUE_JWT_ADMIN_ROLES: service_role
      GOTRUE_JWT_AUD: authenticated
      GOTRUE_JWT_DEFAULT_GROUP_NAME: authenticated
      GOTRUE_JWT_EXP: ${{JWT_EXPIRY}}
      GOTRUE_JWT_SECRET: ${{JWT_SECRET}}
      GOTRUE_EXTERNAL_EMAIL_ENABLED: ${{ENABLE_EMAIL_SIGNUP}}
      GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED: ${{ENABLE_ANONYMOUS_USERS}}
      GOTRUE_MAILER_AUTOCONFIRM: ${{ENABLE_EMAIL_AUTOCONFIRM}}
      GOTRUE_SMTP_ADMIN_EMAIL: ${{SMTP_ADMIN_EMAIL}}
      GOTRUE_SMTP_HOST: ${{SMTP_HOST}}
      GOTRUE_SMTP_PORT: ${{SMTP_PORT}}
      GOTRUE_SMTP_USER: ${{SMTP_USER}}
      GOTRUE_SMTP_PASS: ${{SMTP_PASS}}
      GOTRUE_SMTP_SENDER_NAME: ${{SMTP_SENDER_NAME}}
      GOTRUE_MAILER_URLPATHS_INVITE: ${{MAILER_URLPATHS_INVITE}}
      GOTRUE_MAILER_URLPATHS_CONFIRMATION: ${{MAILER_URLPATHS_CONFIRMATION}}
      GOTRUE_MAILER_URLPATHS_RECOVERY: ${{MAILER_URLPATHS_RECOVERY}}
      GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE: ${{MAILER_URLPATHS_EMAIL_CHANGE}}
      GOTRUE_EXTERNAL_PHONE_ENABLED: ${{ENABLE_PHONE_SIGNUP}}
      GOTRUE_SMS_AUTOCONFIRM: ${{ENABLE_PHONE_AUTOCONFIRM}}

  rest:
    container_name: {self.project_name}-rest
    image: postgrest/postgrest:v12.2.8
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      analytics:
        condition: service_healthy
    environment:
      # Use the internal port for PostgreSQL (5432) for container-to-container communication
      PGRST_DB_URI: postgres://authenticator:${{POSTGRES_PASSWORD}}@${{POSTGRES_HOST}}:5432/${{POSTGRES_DB}}
      PGRST_DB_SCHEMAS: ${{PGRST_DB_SCHEMAS}}
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: ${{JWT_SECRET}}
      PGRST_DB_USE_LEGACY_GUCS: "false"
      PGRST_APP_SETTINGS_JWT_SECRET: ${{JWT_SECRET}}
      PGRST_APP_SETTINGS_JWT_EXP: ${{JWT_EXPIRY}}
    command:
      [
        "postgrest"
      ]

  realtime:
    container_name: realtime-dev.{self.project_name}-realtime
    image: supabase/realtime:v2.34.43
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      analytics:
        condition: service_healthy
    healthcheck:
      test:
        [
          "CMD",
          "curl",
          "-sSfL",
          "--head",
          "-o",
          "/dev/null",
          "-H",
          "Authorization: Bearer ${{ANON_KEY}}",
          "http://localhost:4000/api/tenants/realtime-dev/health"
        ]
      timeout: 5s
      interval: 5s
      retries: 3
    environment:
      PORT: 4000
      DB_HOST: ${{POSTGRES_HOST}}
      # Use the internal port for PostgreSQL (5432) for container-to-container communication
      DB_PORT: 5432
      DB_USER: supabase_admin
      DB_PASSWORD: ${{POSTGRES_PASSWORD}}
      DB_NAME: ${{POSTGRES_DB}}
      DB_AFTER_CONNECT_QUERY: 'SET search_path TO _realtime'
      DB_ENC_KEY: supabaserealtime
      API_JWT_SECRET: ${{JWT_SECRET}}
      SECRET_KEY_BASE: ${{SECRET_KEY_BASE}}
      ERL_AFLAGS: -proto_dist inet_tcp
      DNS_NODES: "''"
      RLIMIT_NOFILE: "10000"
      APP_NAME: realtime
      SEED_SELF_HOST: true
      RUN_JANITOR: true

  storage:
    container_name: {self.project_name}-storage
    image: supabase/storage-api:v1.19.3
    restart: unless-stopped
    volumes:
      - ./volumes/storage:/var/lib/storage:z
    healthcheck:
      test:
        [
          "CMD",
          "wget",
          "--no-verbose",
          "--tries=1",
          "--spider",
          "http://storage:5000/status"
        ]
      timeout: 5s
      interval: 5s
      retries: 3
    depends_on:
      db:
        condition: service_healthy
      rest:
        condition: service_started
      imgproxy:
        condition: service_started
    environment:
      ANON_KEY: ${{ANON_KEY}}
      SERVICE_KEY: ${{SERVICE_ROLE_KEY}}
      POSTGREST_URL: http://rest:3000
      PGRST_JWT_SECRET: ${{JWT_SECRET}}
      # Use the internal port for PostgreSQL (5432) for container-to-container communication
      DATABASE_URL: postgres://supabase_storage_admin:${{POSTGRES_PASSWORD}}@${{POSTGRES_HOST}}:5432/${{POSTGRES_DB}}
      FILE_SIZE_LIMIT: 52428800
      STORAGE_BACKEND: file
      FILE_STORAGE_BACKEND_PATH: /var/lib/storage
      TENANT_ID: stub
      REGION: stub
      GLOBAL_S3_BUCKET: stub
      ENABLE_IMAGE_TRANSFORMATION: "true"
      IMGPROXY_URL: http://imgproxy:5001

  imgproxy:
    container_name: {self.project_name}-imgproxy
    image: darthsim/imgproxy:v3.8.0
    restart: unless-stopped
    volumes:
      - ./volumes/storage:/var/lib/storage:z
    healthcheck:
      test:
        [
          "CMD",
          "imgproxy",
          "health"
        ]
      timeout: 5s
      interval: 5s
      retries: 3
    environment:
      IMGPROXY_BIND: ":5001"
      IMGPROXY_LOCAL_FILESYSTEM_ROOT: /
      IMGPROXY_USE_ETAG: "true"
      IMGPROXY_ENABLE_WEBP_DETECTION: ${{IMGPROXY_ENABLE_WEBP_DETECTION}}

  meta:
    container_name: {self.project_name}-meta
    image: supabase/postgres-meta:v0.87.1
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      analytics:
        condition: service_healthy
    environment:
      PG_META_PORT: 8080
      PG_META_DB_HOST: ${{POSTGRES_HOST}}
      # Use the internal port for PostgreSQL (5432) for container-to-container communication
      PG_META_DB_PORT: 5432
      PG_META_DB_NAME: ${{POSTGRES_DB}}
      PG_META_DB_USER: supabase_admin
      PG_META_DB_PASSWORD: ${{POSTGRES_PASSWORD}}

  functions:
    container_name: {self.project_name}-edge-functions
    image: supabase/edge-runtime:v1.67.4
    restart: unless-stopped
    volumes:
      - ./volumes/functions:/home/deno/functions:Z
    depends_on:
      analytics:
        condition: service_healthy
    environment:
      JWT_SECRET: ${{JWT_SECRET}}
      SUPABASE_URL: http://kong:8000
      SUPABASE_ANON_KEY: ${{ANON_KEY}}
      SUPABASE_SERVICE_ROLE_KEY: ${{SERVICE_ROLE_KEY}}
      # Use the internal port for PostgreSQL (5432) for container-to-container communication
      SUPABASE_DB_URL: postgresql://postgres:${{POSTGRES_PASSWORD}}@${{POSTGRES_HOST}}:5432/${{POSTGRES_DB}}
      VERIFY_JWT: "${{FUNCTIONS_VERIFY_JWT}}"
    command:
      [
        "start",
        "--main-service",
        "/home/deno/functions/main"
      ]

  analytics:
    container_name: {self.project_name}-analytics
    image: supabase/logflare:1.12.0
    restart: unless-stopped
    ports:
      - "{self.ports['analytics']}:4000"
    healthcheck:
      test:
        [
          "CMD",
          "curl",
          "http://localhost:4000/health"
        ]
      timeout: 5s
      interval: 5s
      retries: 10
    depends_on:
      db:
        condition: service_healthy
    environment:
      LOGFLARE_NODE_HOST: 127.0.0.1
      DB_USERNAME: supabase_admin
      DB_DATABASE: _supabase
      DB_HOSTNAME: ${{POSTGRES_HOST}}
      # Use the internal port for Postgre
      # SQL (5432) for container-to-container communication
      DB_PORT: 5432
      DB_PASSWORD: ${{POSTGRES_PASSWORD}}
      DB_SCHEMA: _analytics
      LOGFLARE_API_KEY: ${{LOGFLARE_API_KEY}}
      LOGFLARE_SINGLE_TENANT: true
      LOGFLARE_SUPABASE_MODE: true
      LOGFLARE_MIN_CLUSTER_SIZE: 1
      # Use the internal port for PostgreSQL (5432) for container-to-container communication
      POSTGRES_BACKEND_URL: postgresql://supabase_admin:${{POSTGRES_PASSWORD}}@${{POSTGRES_HOST}}:5432/_supabase
      POSTGRES_BACKEND_SCHEMA: _analytics
      LOGFLARE_FEATURE_FLAG_OVERRIDE: multibackend=true

  db:
    container_name: {self.project_name}-db
    image: supabase/postgres:15.8.1.060
    restart: unless-stopped
    volumes:
      - ./volumes/db/realtime.sql:/docker-entrypoint-initdb.d/migrations/99-realtime.sql:Z
      - ./volumes/db/webhooks.sql:/docker-entrypoint-initdb.d/init-scripts/98-webhooks.sql:Z
      - ./volumes/db/roles.sql:/docker-entrypoint-initdb.d/init-scripts/99-roles.sql:Z
      - ./volumes/db/jwt.sql:/docker-entrypoint-initdb.d/init-scripts/99-jwt.sql:Z
      - ./volumes/db/data:/var/lib/postgresql/data:Z
      - ./volumes/db/_supabase.sql:/docker-entrypoint-initdb.d/migrations/97-_supabase.sql:Z
      - ./volumes/db/logs.sql:/docker-entrypoint-initdb.d/migrations/99-logs.sql:Z
      - ./volumes/db/pooler.sql:/docker-entrypoint-initdb.d/migrations/99-pooler.sql:Z
      - {self.project_name}_db-config:/etc/postgresql-custom
    healthcheck:
      test:
        [
        "CMD",
        "pg_isready",
        "-U",
        "postgres",
        "-d",
        "_supabase",
        "-h",
        "localhost"
        ]
      interval: 5s
      timeout: 5s
      retries: 10
    depends_on:
      vector:
        condition: service_healthy
    ports:
      - "{self.ports['postgres']}:5432"
    environment:
      POSTGRES_HOST: /var/run/postgresql
      PGPORT: 5432
      POSTGRES_PORT: 5432
      PGPASSWORD: ${{POSTGRES_PASSWORD}}
      POSTGRES_PASSWORD: ${{POSTGRES_PASSWORD}}
      PGDATABASE: ${{POSTGRES_DB}}
      POSTGRES_DB: ${{POSTGRES_DB}}
      JWT_SECRET: ${{JWT_SECRET}}
      JWT_EXP: ${{JWT_EXPIRY}}
    command:
      [
        "postgres",
        "-c",
        "config_file=/etc/postgresql/postgresql.conf",
        "-c",
        "log_min_messages=fatal"
      ]

  vector:
    container_name: {self.project_name}-vector
    image: timberio/vector:0.28.1-alpine
    restart: unless-stopped
    volumes:
      - ./volumes/logs/vector.yml:/etc/vector/vector.yml:ro,z
      - /var/run/docker.sock:/var/run/docker.sock:ro,z
    healthcheck:
      test:
        [
          "CMD",
          "wget",
          "--no-verbose",
          "--tries=1",
          "--spider",
          "http://vector:9001/health"
        ]
      timeout: 5s
      interval: 5s
      retries: 3
    environment:
      LOGFLARE_API_KEY: ${{LOGFLARE_API_KEY}}
    command:
      [
        "--config",
        "/etc/vector/vector.yml"
      ]
    security_opt:
      - "label=disable"

  pooler:
    container_name: {self.project_name}-pooler
    image: supabase/supavisor:2.4.14
    restart: unless-stopped
    ports:
      - "{self.ports['pooler']}:6543"
    volumes:
      - ./volumes/pooler/pooler.exs:/etc/pooler/pooler.exs:ro,z
    healthcheck:
      test:
        [
          "CMD",
          "curl",
          "-sSfL",
          "--head",
          "-o",
          "/dev/null",
          "http://127.0.0.1:4000/api/health"
        ]
      interval: 10s
      timeout: 5s
      retries: 5
    depends_on:
      db:
        condition: service_healthy
      analytics:
        condition: service_healthy
    environment:
      PORT: 4000
      POSTGRES_PORT: 5432
      POSTGRES_DB: ${{POSTGRES_DB}}
      POSTGRES_PASSWORD: ${{POSTGRES_PASSWORD}}
      # Use the internal port for PostgreSQL (5432) for container-to-container communication
      DATABASE_URL: ecto://supabase_admin:${{POSTGRES_PASSWORD}}@db:5432/_supabase
      CLUSTER_POSTGRES: true
      SECRET_KEY_BASE: ${{SECRET_KEY_BASE}}
      VAULT_ENC_KEY: ${{VAULT_ENC_KEY}}
      API_JWT_SECRET: ${{JWT_SECRET}}
      METRICS_JWT_SECRET: ${{JWT_SECRET}}
      REGION: local
      ERL_AFLAGS: -proto_dist inet_tcp
      POOLER_TENANT_ID: ${{POOLER_TENANT_ID}}
      POOLER_DEFAULT_POOL_SIZE: ${{POOLER_DEFAULT_POOL_SIZE}}
      POOLER_MAX_CLIENT_CONN: ${{POOLER_MAX_CLIENT_CONN}}
      POOLER_POOL_MODE: transaction
    command:
      [
        "/bin/sh",
        "-c",
        "/app/bin/migrate && /app/bin/supavisor eval \\"$$(cat /etc/pooler/pooler.exs)\\" && /app/bin/server"
      ]

volumes:
  {self.project_name}_db-config:

networks:
  default:
    name: {self.project_name}-network
"""

    def _init_env_template(self):
        """Initialize .env template."""
        # Generate a random password and JWT secret
        password = ''.join(random.choices(string.ascii_letters + string.digits, k=32))
        jwt_secret = ''.join(random.choices(string.ascii_letters + string.digits, k=48))
        secret_key_base = ''.join(random.choices(string.ascii_letters + string.digits, k=64))
        vault_enc_key = ''.join(random.choices(string.ascii_letters + string.digits, k=32))
        logflare_key = ''.join(random.choices(string.ascii_letters + string.digits, k=32))
        
        self.templates["env"] = f"""############
# Secrets
# YOU MUST CHANGE THESE BEFORE GOING INTO PRODUCTION
############
POSTGRES_PASSWORD={password}
JWT_SECRET={jwt_secret}
ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q
DASHBOARD_USERNAME=supabase
DASHBOARD_PASSWORD={self.project_name}
SECRET_KEY_BASE={secret_key_base}
VAULT_ENC_KEY={vault_enc_key}
############
# Database - You can change these to any PostgreSQL database that has logical replication enabled.
############
# This is where other containers connect to the DB container internally
POSTGRES_HOST=db
POSTGRES_DB=postgres
# This port is used for external connections from your host
POSTGRES_PORT={self.ports['postgres']}
# default user is postgres
############
# Supavisor -- Database pooler
############
POOLER_PROXY_PORT_TRANSACTION={self.ports['pooler']}
POOLER_DEFAULT_POOL_SIZE=20
POOLER_MAX_CLIENT_CONN=100
POOLER_TENANT_ID=your-tenant-id
############
# API Proxy - Configuration for the Kong Reverse proxy.
############
KONG_HTTP_PORT={self.ports['kong_http']}
KONG_HTTPS_PORT={self.ports['kong_https']}
############
# API - Configuration for PostgREST.
############
PGRST_DB_SCHEMAS=public,storage,graphql_public
############
# Auth - Configuration for the GoTrue authentication server.
############
## General
SITE_URL=http://localhost:{self.ports['studio']}
ADDITIONAL_REDIRECT_URLS=
JWT_EXPIRY=3600
DISABLE_SIGNUP=false
API_EXTERNAL_URL=http://localhost:{self.ports['kong_http']}
## Mailer Config
MAILER_URLPATHS_CONFIRMATION="/auth/v1/verify"
MAILER_URLPATHS_INVITE="/auth/v1/verify"
MAILER_URLPATHS_RECOVERY="/auth/v1/verify"
MAILER_URLPATHS_EMAIL_CHANGE="/auth/v1/verify"
## Email auth
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
SMTP_ADMIN_EMAIL=admin@example.com
SMTP_HOST=supabase-mail
SMTP_PORT=2500
SMTP_USER=fake_mail_user
SMTP_PASS=fake_mail_password
SMTP_SENDER_NAME=fake_sender
ENABLE_ANONYMOUS_USERS=false
## Phone auth
ENABLE_PHONE_SIGNUP=true
ENABLE_PHONE_AUTOCONFIRM=true
############
# Studio - Configuration for the Dashboard
############
STUDIO_DEFAULT_ORGANIZATION="{self.project_name}"
STUDIO_DEFAULT_PROJECT="{self.project_name}"
STUDIO_PORT={self.ports['studio']}
# replace if you intend to use Studio outside of localhost
SUPABASE_PUBLIC_URL=http://localhost:{self.ports['kong_http']}
# Enable webp support
IMGPROXY_ENABLE_WEBP_DETECTION=true
# Add your OpenAI API key to enable SQL Editor Assistant
OPENAI_API_KEY=
############
# Functions - Configuration for Functions
############
# NOTE: VERIFY_JWT applies to all functions. Per-function VERIFY_JWT is not supported yet.
FUNCTIONS_VERIFY_JWT=false
############
# Logs - Configuration for Logflare
# Please refer to https://supabase.com/docs/reference/self-hosting-analytics/introduction
############
LOGFLARE_LOGGER_BACKEND_API_KEY={logflare_key}
# Change vector.toml sinks to reflect this change
LOGFLARE_API_KEY={logflare_key}
# Docker socket location - this value will differ depending on your OS
DOCKER_SOCKET_LOCATION=/var/run/docker.sock
# Google Cloud Project details
GOOGLE_PROJECT_ID=GOOGLE_PROJECT_ID
GOOGLE_PROJECT_NUMBER=GOOGLE_PROJECT_NUMBER"""

    def _init_vector_template(self):
        """Initialize vector.yml template."""
        try:
            # Try to read the template from the file
            vector_path = Path("projects/multibase/vector.yml")
            if vector_path.exists():
                self.templates["vector"] = vector_path.read_text()
                print(f"Using vector.yml template from {vector_path}")
            else:
                # Fallback to the default template if file doesn't exist
                self.templates["vector"] = """# Default Vector configuration for Supabase
api:
  enabled: true
  address: 0.0.0.0:9001

# Data sources
sources:
  docker_host:
    type: docker_logs
    exclude_containers:
      - __PROJECT__-vector # Exclude vector logs from being ingested by itself

# Data transformations
transforms:
  project_logs:
    type: remap
    inputs:
      - docker_host
    source: |-
      .project = "__PROJECT__"
      .event_message = del(.message)
      .appname = del(.container_name)
      del(.container_created_at)
      del(.container_id)
      del(.source_type)
      del(.stream)
      del(.label)
      del(.image)
      del(.host)
      del(.stream)
  router:
    type: route
    inputs:
      - project_logs
    route:
      kong: '.appname == "__PROJECT__-kong"'
      auth: '.appname == "__PROJECT__-auth"'
      rest: '.appname == "__PROJECT__-rest"'
      realtime: '.appname == "__PROJECT__-realtime"'
      storage: '.appname == "__PROJECT__-storage"'
      functions: '.appname == "__PROJECT__-functions"'
      db: '.appname == "__PROJECT__-db"'

# Data destinations
sinks:
  console_sink:
    type: console
    inputs:
      - project_logs
    encoding:
      codec: json
    target: stdout

  analytics:
    type: http
    inputs:
      - project_logs
    encoding:
      codec: json
    uri: http://__ANALYTICS_SERVICE__:4000/api/logs
    method: post
    auth:
      strategy: bearer
      token: "${LOGFLARE_API_KEY}"
    request:
      headers:
        Content-Type: application/json"""
                print("Using default vector.yml template with placeholders")
        except Exception as e:
            print(f"Error loading vector template: {e}")
            # Fallback to a minimal template
            self.templates["vector"] = """# Default Vector configuration for Supabase
api:
  enabled: true
  address: 0.0.0.0:9001

# Data sources
sources:
  docker_syslog:
    type: docker_logs
    docker_host: unix:///var/run/docker.sock

# Data transformations
transforms:
  parse_logs:
    type: remap
    inputs:
      - docker_syslog
    source: |
      .parsed = .message
      .container_name = .container_name
      .timestamp = .timestamp

# Data destinations
sinks:
  console:
    type: console
    inputs:
      - parse_logs
    encoding:
      codec: json

  analytics:
    type: http
    inputs:
      - parse_logs
    encoding:
      codec: json
    uri: http://__ANALYTICS_SERVICE__:4000/api/logs
    method: post
    auth:
      strategy: bearer
      token: "${LOGFLARE_API_KEY}"
    request:
      headers:
        Content-Type: application/json"""
            print("Using minimal vector.yml template with analytics placeholder")

    def _init_kong_template(self):
        """Initialize Kong API Gateway configuration."""
        anon_key = self._extract_env_value("ANON_KEY")
        service_key = self._extract_env_value("SERVICE_ROLE_KEY")
        dashboard_username = self._extract_env_value("DASHBOARD_USERNAME")
        dashboard_password = self._extract_env_value("DASHBOARD_PASSWORD")

        self.templates["kong"] = f"""_format_version: '2.1'
_transform: true

consumers:
  - username: DASHBOARD
  - username: anon
    keyauth_credentials:
      - key: {anon_key}
  - username: service_role
    keyauth_credentials:
      - key: {service_key}

acls:
  - consumer: anon
    group: anon
  - consumer: service_role
    group: admin

basicauth_credentials:
  - consumer: DASHBOARD
    username: {dashboard_username}
    password: {dashboard_password}

services:
  - name: auth-v1
    url: http://auth:9999/verify
    routes:
      - name: auth-v1-route
        paths:
          - /auth/v1/verify
    plugins:
      - name: cors
  - name: auth-v1-api
    url: http://auth:9999
    routes:
      - name: auth-v1-api-route
        paths:
          - /auth/v1
    plugins:
      - name: cors
  - name: auth-v1-admin
    url: http://auth:9999/admin
    routes:
      - name: auth-v1-admin-route
        paths:
          - /auth/v1/admin
    plugins:
      - name: cors
      - name: key-auth
        config:
          hide_credentials: true
      - name: acl
        config:
          hide_groups_header: true
          allow:
            - admin
  - name: rest
    url: http://rest:3000
    routes:
      - name: rest-route
        paths:
          - /rest/v1
    plugins:
      - name: cors
  - name: postgrest
    url: http://rest:3000
    routes:
      - name: postgrest-route
        paths:
          - /
        strip_path: false
    plugins:
      - name: cors
  - name: realtime
    url: http://realtime:4000/socket/
    routes:
      - name: realtime-route
        paths:
          - /realtime/v1
        strip_path: true
    plugins:
      - name: cors
  - name: storage
    url: http://storage:5000
    routes:
      - name: storage-route
        paths:
          - /storage/v1
    plugins:
      - name: cors
  - name: meta
    url: http://meta:8080
    routes:
      - name: meta-route
        paths:
          - /pg
    plugins:
      - name: cors
      - name: key-auth
        config:
          hide_credentials: true
      - name: acl
        config:
          hide_groups_header: true
          allow:
            - admin
  - name: functions
    url: http://functions:9000
    routes:
      - name: functions-route
        paths:
          - /functions/v1
    plugins:
      - name: cors
"""

    def _extract_env_value(self, key):
        """Extract a value from the env template or return a placeholder."""
        env = self.templates.get("env", "")
        for line in env.splitlines():
            if line.startswith(f"{key}="):
                return line.split("=", 1)[1].strip()
        return f"missing_{key}"

    def _init_pooler_template(self):
        """Initialize pooler configuration."""
        self.templates["pooler"] = """{:ok, _} = Application.ensure_all_started(:supavisor)

{:ok, version} =
  case Supavisor.Repo.query!("select version()") do
    %{rows: [[ver]]} -> Supavisor.Helpers.parse_pg_version(ver)
    _ -> nil
  end

params = %{
  "external_id" => System.get_env("POOLER_TENANT_ID"),
  "db_host" => "db",
  "db_port" => System.get_env("POSTGRES_PORT"),
  "db_database" => System.get_env("POSTGRES_DB"),
  "require_user" => false,
  "auth_query" => "SELECT * FROM pgbouncer.get_auth($1)",
  "default_max_clients" => System.get_env("POOLER_MAX_CLIENT_CONN"),
  "default_pool_size" => System.get_env("POOLER_DEFAULT_POOL_SIZE"),
  "default_parameter_status" => %{"server_version" => version},
  "users" => [%{
    "db_user" => "pgbouncer",
    "db_password" => System.get_env("POSTGRES_PASSWORD"),
    "mode_type" => System.get_env("POOLER_POOL_MODE"),
    "pool_size" => System.get_env("POOLER_DEFAULT_POOL_SIZE"),
    "is_manager" => true
  }]
}

if !Supavisor.Tenants.get_tenant_by_external_id(params["external_id"]) do
  {:ok, _} = Supavisor.Tenants.create_tenant(params)
end
"""

    def _init_db_templates(self):
        """Initialize database SQL templates."""
        self.templates["supabase_sql"] = """\\set pguser `echo "$POSTGRES_USER"`

CREATE DATABASE _supabase WITH OWNER :pguser;"""

        self.templates["logs_sql"] = """\\set pguser `echo "$POSTGRES_USER"`

\\c _supabase
create schema if not exists _analytics;
alter schema _analytics owner to :pguser;
\\c postgres"""

        self.templates["jwt_sql"] = """\\set jwt_secret `echo "$JWT_SECRET"`
\\set jwt_exp `echo "$JWT_EXP"`

ALTER DATABASE postgres SET "app.settings.jwt_secret" TO :'jwt_secret';
ALTER DATABASE postgres SET "app.settings.jwt_exp" TO :'jwt_exp';"""

        self.templates["pooler_sql"] = """\\set pguser `echo "$POSTGRES_USER"`

\\c _supabase
create schema if not exists _supavisor;
alter schema _supavisor owner to :pguser;
\\c postgres"""

        self.templates["realtime_sql"] = """\\set pguser `echo "$POSTGRES_USER"`

create schema if not exists _realtime;
alter schema _realtime owner to :pguser;"""

        self.templates["roles_sql"] = """-- NOTE: change to your own passwords for production environments
\\set pgpass `echo "$POSTGRES_PASSWORD"`

ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER pgbouncer WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_functions_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_storage_admin WITH PASSWORD :'pgpass';"""

        self.templates["webhooks_sql"] = """BEGIN;
  -- Create pg_net extension
  CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
  -- Create supabase_functions schema
  CREATE SCHEMA supabase_functions AUTHORIZATION supabase_admin;
  GRANT USAGE ON SCHEMA supabase_functions TO postgres, anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA supabase_functions GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA supabase_functions GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA supabase_functions GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
  -- supabase_functions.migrations definition
  CREATE TABLE supabase_functions.migrations (
    version text PRIMARY KEY,
    inserted_at timestamptz NOT NULL DEFAULT NOW()
  );
  -- Initial supabase_functions migration
  INSERT INTO supabase_functions.migrations (version) VALUES ('initial');
  -- supabase_functions.hooks definition
  CREATE TABLE supabase_functions.hooks (
    id bigserial PRIMARY KEY,
    hook_table_id integer NOT NULL,
    hook_name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    request_id bigint
  );
  CREATE INDEX supabase_functions_hooks_request_id_idx ON supabase_functions.hooks USING btree (request_id);
  CREATE INDEX supabase_functions_hooks_h_table_id_h_name_idx ON supabase_functions.hooks USING btree (hook_table_id, hook_name);
  COMMENT ON TABLE supabase_functions.hooks IS 'Supabase Functions Hooks: Audit trail for triggered hooks.';
  CREATE FUNCTION supabase_functions.http_request()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $function$
    DECLARE
      request_id bigint;
      payload jsonb;
      url text := TG_ARGV[0]::text;
      method text := TG_ARGV[1]::text;
      headers jsonb DEFAULT '{}'::jsonb;
      params jsonb DEFAULT '{}'::jsonb;
      timeout_ms integer DEFAULT 1000;
    BEGIN
      IF url IS NULL OR url = 'null' THEN
        RAISE EXCEPTION 'url argument is missing';
      END IF;

      IF method IS NULL OR method = 'null' THEN
        RAISE EXCEPTION 'method argument is missing';
      END IF;

      IF TG_ARGV[2] IS NULL OR TG_ARGV[2] = 'null' THEN
        headers = '{"Content-Type": "application/json"}'::jsonb;
      ELSE
        headers = TG_ARGV[2]::jsonb;
      END IF;

      IF TG_ARGV[3] IS NULL OR TG_ARGV[3] = 'null' THEN
        params = '{}'::jsonb;
      ELSE
        params = TG_ARGV[3]::jsonb;
      END IF;

      IF TG_ARGV[4] IS NULL OR TG_ARGV[4] = 'null' THEN
        timeout_ms = 1000;
      ELSE
        timeout_ms = TG_ARGV[4]::integer;
      END IF;

      CASE
        WHEN method = 'GET' THEN
          SELECT http_get INTO request_id FROM net.http_get(
            url,
            params,
            headers,
            timeout_ms
          );
        WHEN method = 'POST' THEN
          payload = jsonb_build_object(
            'old_record', OLD,
            'record', NEW,
            'type', TG_OP,
            'table', TG_TABLE_NAME,
            'schema', TG_TABLE_SCHEMA
          );

          SELECT http_post INTO request_id FROM net.http_post(
            url,
            payload,
            params,
            headers,
            timeout_ms
          );
        ELSE
          RAISE EXCEPTION 'method argument % is invalid', method;
      END CASE;

      INSERT INTO supabase_functions.hooks
        (hook_table_id, hook_name, request_id)
      VALUES
        (TG_RELID, TG_NAME, request_id);

      RETURN NEW;
    END
  $function$;
  -- Supabase super admin
  DO
  $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;
  END
  $$;
  GRANT ALL PRIVILEGES ON SCHEMA supabase_functions TO supabase_functions_admin;
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA supabase_functions TO supabase_functions_admin;
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA supabase_functions TO supabase_functions_admin;
  ALTER USER supabase_functions_admin SET search_path = "supabase_functions";
  ALTER table "supabase_functions".migrations OWNER TO supabase_functions_admin;
  ALTER table "supabase_functions".hooks OWNER TO supabase_functions_admin;
  ALTER function "supabase_functions".http_request() OWNER TO supabase_functions_admin;
  GRANT supabase_functions_admin TO postgres;
  -- Remove unused supabase_pg_net_admin role
  DO
  $$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_pg_net_admin'
    )
    THEN
      REASSIGN OWNED BY supabase_pg_net_admin TO supabase_admin;
      DROP OWNED BY supabase_pg_net_admin;
      DROP ROLE supabase_pg_net_admin;
    END IF;
  END
  $$;
  -- pg_net grants when extension is already enabled
  DO
  $$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM pg_extension
      WHERE extname = 'pg_net'
    )
    THEN
      GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END
  $$;
  -- Event trigger for pg_net
  CREATE OR REPLACE FUNCTION extensions.grant_pg_net_access()
  RETURNS event_trigger
  LANGUAGE plpgsql
  AS $$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM pg_event_trigger_ddl_commands() AS ev
      JOIN pg_extension AS ext
      ON ev.objid = ext.oid
      WHERE ext.extname = 'pg_net'
    )
    THEN
      GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END;
  $$;
  COMMENT ON FUNCTION extensions.grant_pg_net_access IS 'Grants access to pg_net';
  DO
  $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_event_trigger
      WHERE evtname = 'issue_pg_net_access'
    ) THEN
      CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end WHEN TAG IN ('CREATE EXTENSION')
      EXECUTE PROCEDURE extensions.grant_pg_net_access();
    END IF;
  END
  $$;
  INSERT INTO supabase_functions.migrations (version) VALUES ('20210809183423_update_grants');
  ALTER function supabase_functions.http_request() SECURITY DEFINER;
  ALTER function supabase_functions.http_request() SET search_path = supabase_functions;
  REVOKE ALL ON FUNCTION supabase_functions.http_request() FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION supabase_functions.http_request() TO postgres, anon, authenticated, service_role;
COMMIT;"""

    def _init_function_templates(self):
        """Initialize Edge Function templates."""
        self.templates["function_main"] = """// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.131.0/http/server.ts";

console.log("Hello from Functions!");

serve(async (req) => {
  const { name } = await req.json();
  const data = {
    message: `Hello ${name}!`,
  };

  return new Response(
    JSON.stringify(data),
    { headers: { "Content-Type": "application/json" } },
  );
});"""

        self.templates["function_hello"] = f"""// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import {{ serve }} from "https://deno.land/std@0.131.0/http/server.ts";

console.log("Hello from Functions!");

serve(async (req) => {{
  const {{ name }} = await req.json();
  const data = {{
    message: `Hello ${{name || "World"}}!`,
    timestamp: new Date().toISOString(),
    projectName: "{self.project_name}",
  }};

  return new Response(
    JSON.stringify(data),
    {{ headers: {{ "Content-Type": "application/json" }} }},
  );
}});"""

    def _init_misc_templates(self):
        """Initialize miscellaneous templates."""
        self.templates["reset_script"] = """#!/bin/sh
# Reset script for Supabase project

echo "Stopping all containers..."
docker compose down -v --remove-orphans

echo "Removing database data..."
rm -rf ./volumes/db/data

echo "Recreating database data directory..."
mkdir -p ./volumes/db/data

echo "Reset complete. You can now start the project with: docker compose up"""

        self.templates["readme"] = f"""# Supabase Project: {self.project_name}

This is a self-hosted Supabase deployment with custom port configurations.

## Port Configuration

- Kong HTTP API: {self.ports['kong_http']}
- Kong HTTPS API: {self.ports['kong_https']}
- PostgreSQL: {self.ports['postgres']}
- Pooler (Connection Pooler): {self.ports['pooler']}
- Studio Dashboard: {self.ports['studio']}
- Analytics: {self.ports['analytics']}
"""
