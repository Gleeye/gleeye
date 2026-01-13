-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS
CREATE TYPE service_logic_type AS ENUM ('OR', 'AND', 'TEAM_SIZE');
CREATE TYPE booking_status AS ENUM ('hold', 'confirmed', 'cancelled', 'completed', 'no_show', 'rescheduled');
CREATE TYPE calendar_provider AS ENUM ('google', 'apple', 'other_ical');
CREATE TYPE week_day AS ENUM ('0', '1', '2', '3', '4', '5', '6'); -- 0=Sunday

-- 2. TABLES

-- Services
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2),
    duration_minutes INTEGER NOT NULL,
    buffer_minutes INTEGER DEFAULT 0,
    logic_type service_logic_type DEFAULT 'OR',
    team_size_req INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    organization_id UUID -- For potential multi-tenant
);

-- Profiles (Enhancing existing users or generic profiles)
-- Assuming 'auth.users' exists, we link to it or create a public profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    full_name TEXT,
    role TEXT DEFAULT 'user', -- 'admin', 'collaborator', 'user'
    avatar_url TEXT
);

-- Collaborator Services (Many-to-Many)
CREATE TABLE service_collaborators (
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    collaborator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 0,
    PRIMARY KEY (service_id, collaborator_id)
);

-- Availability Rules (Recurring)
CREATE TABLE availability_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    collaborator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    UNIQUE (collaborator_id, day_of_week, start_time)
);

-- Availability Overrides (Exceptions)
CREATE TABLE availability_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    collaborator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT FALSE,
    start_time TIME, -- If available=true, specific hours
    end_time TIME
);

-- External Calendar Connections
CREATE TABLE external_calendar_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE TABLE external_busy_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    collaborator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    source TEXT, -- 'google', 'apple'
    description TEXT
);
-- Index for fast range queries
CREATE INDEX idx_busy_cache_range ON external_busy_cache (collaborator_id, start_time, end_time);

-- Bookings
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE INDEX idx_bookings_range ON bookings (start_time, end_time);

-- Booking Assignments (Who specifically is doing the job)
CREATE TABLE booking_assignments (
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    collaborator_id UUID REFERENCES profiles(id),
    PRIMARY KEY (booking_id, collaborator_id)
);

-- Booking Holds (Redis-like table for concurrency)
CREATE TABLE booking_holds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    service_id UUID REFERENCES services(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    session_id TEXT NOT NULL, -- Browser fingerprint / session
    expires_at TIMESTAMPTZ NOT NULL
);

-- RLS POLICIES (Examples)
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Users see their own bookings
CREATE POLICY "Users view own bookings" ON bookings 
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() IN (SELECT collaborator_id FROM booking_assignments WHERE booking_id = bookings.id));

-- Admins see all
-- (Assuming 'admin' role check function exists)
