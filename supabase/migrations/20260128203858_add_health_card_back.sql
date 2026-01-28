-- Migration to add document_health_card_back_url to collaborators table
ALTER TABLE collaborators 
ADD COLUMN IF NOT EXISTS document_health_card_back_url text;