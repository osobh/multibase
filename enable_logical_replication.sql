-- Enable logical replication (run as superuser)
ALTER SYSTEM SET wal_level = logical;
SELECT pg_reload_conf();

-- Create publication for logical replication if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'logflare_pub') THEN
        CREATE PUBLICATION logflare_pub FOR ALL TABLES;
    END IF;
END
$$;
