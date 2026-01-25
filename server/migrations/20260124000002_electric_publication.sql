-- Create publication for ElectricSQL (if it doesn't exist)
-- This requires superuser privileges on managed databases
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'electric_publication') THEN
        CREATE PUBLICATION electric_publication FOR ALL TABLES;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- If we can't create publication (e.g., no superuser), that's OK
        -- ElectricSQL can still work with explicit table subscriptions
        NULL;
END $$;