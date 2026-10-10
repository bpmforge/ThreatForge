-- =============================================================================
-- ThreatForge - Database Initialization Script
-- =============================================================================
--
-- This script runs when the PostgreSQL container is first created.
-- It sets up extensions and basic configuration.
--
-- Note: Schema creation is handled by Prisma migrations, not this script.
-- =============================================================================

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";     -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- Cryptographic functions

-- Create database comment
COMMENT ON DATABASE flowthreat IS 'ThreatForge - Visual threat modeling tool';

-- Performance configuration (for development - adjust for production)
-- These are SET at session level; for persistent changes, use postgresql.conf
-- ALTER SYSTEM SET shared_buffers = '256MB';
-- ALTER SYSTEM SET effective_cache_size = '1GB';
-- ALTER SYSTEM SET work_mem = '16MB';

-- Log slow queries (development aid)
-- ALTER SYSTEM SET log_min_duration_statement = '200ms';

-- Notify that initialization is complete
DO $$
BEGIN
    RAISE NOTICE 'ThreatForge database initialized successfully';
END $$;
