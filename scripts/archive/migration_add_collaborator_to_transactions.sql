ALTER TABLE public.bank_transactions 
ADD COLUMN IF NOT EXISTS collaborator_id UUID REFERENCES public.collaborators(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bank_trans_collaborator_id ON public.bank_transactions(collaborator_id);
