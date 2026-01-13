-- Add assignment_id to collaborator_services to link services to specific assignments
ALTER TABLE public.collaborator_services
ADD COLUMN IF NOT EXISTS assignment_id UUID REFERENCES public.assignments(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.collaborator_services.assignment_id IS 'Link to the specific assignment (Incarico) this service belongs to';
