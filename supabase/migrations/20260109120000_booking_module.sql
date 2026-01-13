-- Enable UUID extension if not enabled (Though gen_random_uuid is native in PG13+)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS (Safe creation)
DO $$ BEGIN
    CREATE TYPE service_logic_type AS ENUM ('OR', 'AND', 'TEAM_SIZE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE booking_status AS ENUM ('hold', 'confirmed', 'cancelled', 'completed', 'no_show', 'rescheduled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE calendar_provider AS ENUM ('google', 'apple', 'other_ical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. TABLES

-- Services: Handle existing or new
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add Booking Columns to Services
ALTER TABLE services ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2);
ALTER TABLE services ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60;
ALTER TABLE services ADD COLUMN IF NOT EXISTS buffer_minutes INTEGER DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS logic_type service_logic_type DEFAULT 'OR';
ALTER TABLE services ADD COLUMN IF NOT EXISTS team_size_req INTEGER DEFAULT 1;
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Profiles: Ensure existence
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    full_name TEXT,
    role TEXT DEFAULT 'user',
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Collaborator Services (Many-to-Many)
CREATE TABLE IF NOT EXISTS service_collaborators (
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    collaborator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 0,
    PRIMARY KEY (service_id, collaborator_id)
);

-- Availability Rules (Recurring)
CREATE TABLE IF NOT EXISTS availability_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collaborator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    UNIQUE (collaborator_id, day_of_week, start_time)
);

-- Availability Overrides (Exceptions)
CREATE TABLE IF NOT EXISTS availability_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collaborator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT FALSE,
    start_time TIME, -- If available=true, specific hours
    end_time TIME
);

-- External Calendar Connections
CREATE TABLE IF NOT EXISTS external_calendar_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collaborator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    provider calendar_provider NOT NULL,
    email TEXT,
    access_token TEXT, -- Encrypt in valid impl
    refresh_token TEXT, -- Encrypt in valid impl
    expires_at TIMESTAMPTZ,
    calendar_id TEXT DEFAULT 'primary',
    ics_url TEXT, -- For read-only imports
    last_synced_at TIMESTAMPTZ,
    UNIQUE (collaborator_id, provider)
);

-- External Busy Cache (Flattened busy times from GCal/Apple)
CREATE TABLE IF NOT EXISTS external_busy_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collaborator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    source TEXT, -- 'google', 'apple'
    description TEXT
);
-- Index for fast range queries
DROP INDEX IF EXISTS idx_busy_cache_range;
CREATE INDEX idx_busy_cache_range ON external_busy_cache (collaborator_id, start_time, end_time);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    service_id UUID REFERENCES services(id),
    user_id UUID REFERENCES profiles(id), -- Nullable for guest
    guest_info JSONB, -- {name, email, phone}
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status booking_status DEFAULT 'confirmed',
    google_event_id TEXT,
    notes TEXT
);
DROP INDEX IF EXISTS idx_bookings_range;
CREATE INDEX idx_bookings_range ON bookings (start_time, end_time);

-- Booking Assignments (Who specifically is doing the job)
CREATE TABLE IF NOT EXISTS booking_assignments (
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    collaborator_id UUID REFERENCES profiles(id),
    PRIMARY KEY (booking_id, collaborator_id)
);

-- Booking Holds (Redis-like table for concurrency)
CREATE TABLE IF NOT EXISTS booking_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    service_id UUID REFERENCES services(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    session_id TEXT NOT NULL, -- Browser fingerprint / session
    expires_at TIMESTAMPTZ NOT NULL
);

-- RLS POLICIES (Safe creation)
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    Create POLICY "Users view own bookings" ON bookings 
        FOR SELECT USING (auth.uid() = user_id OR auth.uid() IN (SELECT collaborator_id FROM booking_assignments WHERE booking_id = bookings.id));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
