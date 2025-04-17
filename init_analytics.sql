-- Combined initialization script for analytics database
\set pguser `echo "$POSTGRES_USER"`

-- First, create the _supabase database if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '_supabase') THEN
        CREATE DATABASE _supabase WITH OWNER :pguser;
    END IF;
END
$$;

-- Connect to the _supabase database
\c _supabase

-- Create the _analytics schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS _analytics;
ALTER SCHEMA _analytics OWNER TO :pguser;

-- Create necessary tables for analytics
CREATE TABLE IF NOT EXISTS _analytics.sources (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS _analytics.metrics (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES _analytics.sources(id),
    name TEXT NOT NULL,
    value NUMERIC,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA _analytics TO supabase_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA _analytics TO supabase_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA _analytics TO supabase_admin;

-- Return to postgres database
\c postgres
