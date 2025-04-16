#!/usr/bin/env python3
"""
Supabase Project Setup Tool

This script creates a new Supabase self-hosted deployment with custom port mappings.
It creates a directory structure with all necessary configuration files.
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
        self.project_name = project_name
        self.base_port = base_port
        self.project_dir = Path(project_name)
        
        # Calculate ports
        self.ports = self._calculate_ports()
        
        # Create project directory
        self._create_project_directory()
        
        # Templates and content
        self.templates = {}
        self._initialize_templates()

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
        self._init_entrypoint_template()
        self._init_misc_templates()

    def _init_docker_compose_template(self):
        """Initialize docker-compose.yml template."""
        self.templates["docker_compose"] = f"""version: '3'

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
      GOTRUE_DB_DATABASE_URL: postgres://supabase_auth_admin:${{POSTGRES_PASSWORD}}@${{POSTGRES_HOST}}:${{POSTGRES_PORT}}/${{POSTGRES_DB}}
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
      PGRST_DB_URI: postgres://authenticator:${{POSTGRES_PASSWORD}}@${{POSTGRES_HOST}}:${{POSTGRES_PORT}}/${{POSTGRES_DB}}
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
      DB_PORT: ${{POSTGRES_PORT}}
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
      DATABASE_URL: postgres://supabase_storage_admin:${{POSTGRES_PASSWORD}}@${{POSTGRES_HOST}}:${{POSTGRES_PORT}}/${{POSTGRES_DB}}
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
      PG_META_DB_PORT: ${{POSTGRES_PORT}}
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
      SUPABASE_DB_URL: postgresql://postgres:${{POSTGRES_PASSWORD}}@${{POSTGRES_HOST}}:${{POSTGRES_PORT}}/${{POSTGRES_DB}}
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
    volumes:
      - ./volumes/analytics/entrypoint.sh:/entrypoint.sh:ro,z
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
      DB_PORT: ${{POSTGRES_PORT}}
      DB_PASSWORD: ${{POSTGRES_PASSWORD}}
      DB_SCHEMA: _analytics
      LOGFLARE_API_KEY: ${{LOGFLARE_API_KEY}}
      LOGFLARE_SINGLE_TENANT: true
      LOGFLARE_SUPABASE_MODE: true
      LOGFLARE_MIN_CLUSTER_SIZE: 1
      POSTGRES_BACKEND_URL: postgresql://supabase_admin:${{POSTGRES_PASSWORD}}@${{POSTGRES_HOST}}:${{POSTGRES_PORT}}/_supabase
      POSTGRES_BACKEND_SCHEMA: _analytics
      LOGFLARE_FEATURE_FLAG_OVERRIDE: multibackend=true
    command: ["/entrypoint.sh"]

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
POSTGRES_HOST=db
POSTGRES_DB=postgres
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
        self.templates["vector"] = """# Default Vector configuration for Supabase
api:
  enabled: true
  address: 0.0.0.0:9001

# Data sources
sources:
  docker_syslog:
    type: docker_logs
    docker_host: unix:///var/run/docker.sock  # Hardcoded path

# Data transformations
transforms:
  parse_logs:
    type: remap
    inputs:
      - docker_syslog
    source: |
      # Simply store the message and metadata
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
    uri: http://analytics:4000/api/logs
    method: post
    auth:
      strategy: bearer
      token: "${LOGFLARE_API_KEY}"
    request:
      headers:
        Content-Type: application/json"""

    def _init_kong_template(self):
        """Initialize Kong API Gateway configuration."""
        self.templates["kong"] = """_format_version: "2.1"
_transform: true

services:
  - name: auth-v1
    url: http://auth:9999/verify
    routes:
      - name: auth-v1-route
        paths:
          - /auth/v1/verify
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

consumers:
  - username: anonymous
    keyauth_credentials:
      - key: {{ SUPABASE_ANON_KEY }}
  - username: service_role
    keyauth_credentials:
      - key: {{ SUPABASE_SERVICE_KEY }}
    acls:
      - group: admin
  - username: dashboard
    basicauth_credentials:
      - username: {{ DASHBOARD_USERNAME }}
        password: {{ DASHBOARD_PASSWORD }}
    acls:
      - group: admin"""

    def _init_pooler_template(self):
        """Initialize pooler configuration."""
        self.templates["pooler"] = """alias Supavisor.Config
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
|> Config.ensure_user!(user)"""

    def _init_db_templates(self):
        """Initialize database SQL templates."""
        self.templates["supabase_sql"] = """-- Create the _supabase database if it doesn't exist
CREATE DATABASE IF NOT EXISTS _supabase;
\\c _supabase;

-- Create the _analytics schema
CREATE SCHEMA IF NOT EXISTS _analytics;

-- Set up permissions
GRANT ALL PRIVILEGES ON DATABASE _supabase TO supabase_admin;
GRANT ALL PRIVILEGES ON SCHEMA _analytics TO supabase_admin;"""

        self.templates["setup_sql"] = """-- Create the _supabase database
CREATE DATABASE _supabase;

-- Connect to the _supabase database
\\c _supabase;

-- Create the _analytics schema
CREATE SCHEMA _analytics;

-- Grant privileges to supabase_admin
GRANT ALL PRIVILEGES ON DATABASE _supabase TO supabase_admin;
GRANT ALL PRIVILEGES ON SCHEMA _analytics TO supabase_admin;"""

        self.templates["logs_sql"] = """-- Connect to the _supabase database
\\c _supabase;

-- Switch to the _analytics schema
SET search_path TO _analytics;

-- Create tables required for Logflare/analytics if they don't exist
CREATE TABLE IF NOT EXISTS schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);

CREATE TABLE IF NOT EXISTS sources (
    id SERIAL PRIMARY KEY,
    name text NOT NULL,
    token text NOT NULL UNIQUE,
    public boolean DEFAULT false,
    metrics jsonb,
    user_id integer,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS source_schemas (
    id SERIAL PRIMARY KEY,
    source_id integer REFERENCES sources (id) ON DELETE CASCADE,
    schema jsonb,
    bigquery_schema jsonb,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL
);

-- Add more tables as needed for the analytics system

-- Ensure proper permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA _analytics TO supabase_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA _analytics TO supabase_admin;"""

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

    def _init_entrypoint_template(self):
        """Initialize analytics entrypoint script."""
        self.templates["entrypoint"] = """#!/bin/sh

# Wait for Postgres to be ready
echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h "${DB_HOSTNAME}" -p "${DB_PORT}" -U "${DB_USERNAME}" > /dev/null 2>&1; do
  echo "Postgres is unavailable - sleeping 2s"
  sleep 2
done
echo "PostgreSQL is ready!"

# Try to connect to _supabase database
for i in $(seq 1 10); do
  echo "Attempting to connect to _supabase database (attempt $i/10)..."
  
  if psql -h "${DB_HOSTNAME}" -p "${DB_PORT}" -U "${DB_USERNAME}" -d _supabase -c '\q' > /dev/null 2>&1; then
    echo "_supabase database exists and is accessible!"
    break
  fi
  
  if [ $i -eq 10 ]; then
    echo "Failed to connect to _supabase database after 10 attempts."
    echo "Creating _supabase database and analytics schema..."
    
    # Create the _supabase database and set up schema
    psql -h "${DB_HOSTNAME}" -p "${DB_PORT}" -U "${DB_USERNAME}" -d postgres -c '
      CREATE DATABASE _supabase;
    '
    
    psql -h "${DB_HOSTNAME}" -p "${DB_PORT}" -U "${DB_USERNAME}" -d _supabase -c '
      CREATE SCHEMA _analytics;
      GRANT ALL PRIVILEGES ON DATABASE _supabase TO supabase_admin;
      GRANT ALL PRIVILEGES ON SCHEMA _analytics TO supabase_admin;
    '
    
    echo "Created _supabase database and analytics schema."
  fi
  
  sleep 3
done

# Start the Logflare service
echo "Starting Logflare..."
exec "/app/bin/logflare" "start"""

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

## Getting Started

1. Start the services:
   ```
   docker compose up -d
   ```

2. Access the Studio dashboard at:
   ```
   http://localhost:{self.ports['studio']}
   ```

3. API endpoint is available at:
   ```
   http://localhost:{self.ports['kong_http']}
   ```

4. To connect to the database directly:
   ```
   psql -h localhost -p {self.ports['postgres']} -U postgres
   ```

## Reset Environment

To reset the environment and start fresh:
```
./reset.sh
```

## Service Health

You can check the health of your services with:
```
docker compose ps
```

## Logs

To view logs for a specific service:
```
docker compose logs -f [service_name]
```

## Additional Information

For more information about Supabase, visit:
https://supabase.com/docs/reference/self-hosting-analytics/introduction"""

    def create_project_structure(self):
        """Create the project directory structure and files."""
        # Create main directories
        volumes_dir = self.project_dir / "volumes"
        volumes_dir.mkdir()
        
        # Create subdirectories
        dirs = [
            "volumes/logs",
            "volumes/api",
            "volumes/storage/stub",
            "volumes/pooler",
            "volumes/db/init",
            "volumes/db/data",
            "volumes/functions/main",
            "volumes/functions/hello",
            "volumes/analytics"
        ]
        
        for dir_path in dirs:
            (self.project_dir / dir_path).mkdir(parents=True, exist_ok=True)
        
        # Write docker-compose.yml
        with open(self.project_dir / "docker-compose.yml", "w") as f:
            f.write(self.templates["docker_compose"])
        
        # Write .env file
        with open(self.project_dir / ".env", "w") as f:
            f.write(self.templates["env"])
        
        # Write vector.yml
        with open(self.project_dir / "volumes/logs/vector.yml", "w") as f:
            f.write(self.templates["vector"])
        
        # Write kong.yml
        with open(self.project_dir / "volumes/api/kong.yml", "w") as f:
            f.write(self.templates["kong"])
        
        # Write pooler.exs
        with open(self.project_dir / "volumes/pooler/pooler.exs", "w") as f:
            f.write(self.templates["pooler"])
        
        # Write database files
        with open(self.project_dir / "volumes/db/_supabase.sql", "w") as f:
            f.write(self.templates["supabase_sql"])
        
        with open(self.project_dir / "volumes/db/init/setup.sql", "w") as f:
            f.write(self.templates["setup_sql"])
        
        with open(self.project_dir / "volumes/db/logs.sql", "w") as f:
            f.write(self.templates["logs_sql"])
        
        # Write function files
        with open(self.project_dir / "volumes/functions/main/index.ts", "w") as f:
            f.write(self.templates["function_main"])
        
        with open(self.project_dir / "volumes/functions/hello/index.ts", "w") as f:
            f.write(self.templates["function_hello"])
        
        # Write analytics entrypoint script
        entrypoint_path = self.project_dir / "volumes/analytics/entrypoint.sh"
        with open(entrypoint_path, "w") as f:
            f.write(self.templates["entrypoint"])
        # Make entrypoint script executable
        entrypoint_path.chmod(0o755)
        
        # Write reset.sh
        reset_path = self.project_dir / "reset.sh"
        with open(reset_path, "w") as f:
            f.write(self.templates["reset_script"])
        # Make reset script executable
        reset_path.chmod(0o755)
        
        # Write README.md
        with open(self.project_dir / "README.md", "w") as f:
            f.write(self.templates["readme"])

    def run(self):
        """Create the full project setup."""
        self.create_project_structure()
        print(f"\nSupabase project '{self.project_name}' has been successfully created.")
        print("To start the services, run the following commands:")
        print(f"  cd {self.project_name}")
        print("  docker compose up -d")
        print("")
        print("You'll be able to access:")
        print(f"  - Studio dashboard: http://localhost:{self.ports['studio']}")
        print(f"  - API endpoint: http://localhost:{self.ports['kong_http']}")
        print(f"  - PostgreSQL on port: {self.ports['postgres']}")
        print(f"  - Analytics on port: {self.ports['analytics']}")
        print("")
        print("Login credentials:")
        print("  Username: supabase")
        print(f"  Password: {self.project_name}")
        print("")
        print("For more information, see README.md in the project directory.")


def main():
    """Main entry point for the Supabase project generator."""
    parser = argparse.ArgumentParser(description="Create a new Supabase project with custom port mappings")
    parser.add_argument("project_name", help="Name for the new Supabase project (used as directory name)")
    parser.add_argument("--base-port", "-p", type=int, help="Starting port number for port mappings (default: random available port)")
    
    args = parser.parse_args()
    
    try:
        generator = SupabaseProjectGenerator(args.project_name, args.base_port)
        generator.run()
    except FileExistsError as e:
        print(f"Error: {e}")
        return 1
    except Exception as e:
        print(f"Error: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
