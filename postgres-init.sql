-- Grafana PostgreSQL initialization script
-- This script sets up the database for Grafana with optimal settings

-- Create extensions if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set timezone
SET timezone = 'UTC';

-- Create indexes for better performance (Grafana will create its own tables)
-- This is just a placeholder script since Grafana handles its own schema

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE grafana TO grafana;