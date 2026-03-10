CREATE TABLE IF NOT EXISTS pm_ai_report_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_ref UUID REFERENCES pm_spaces(id) ON DELETE CASCADE,
    item_ref UUID,
    audio_url TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable realtime
ALTER TABLE pm_ai_report_jobs REPLICA IDENTITY FULL;
