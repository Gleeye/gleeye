/**
 * sales/api.js
 * Phase 1: prospects + pipeline.
 * Phase 2: niches, sequences, steps, discovery_notes, sends, replies.
 */

import { supabase } from '../../modules/config.js?v=8000';
import { state }    from '../../modules/state.js?v=8000';

// ═══════════════════════════════════════════════════════════════════════════
// PROSPECTS (Phase 1)
// ═══════════════════════════════════════════════════════════════════════════

export async function fetchProspects() {
    const { data, error } = await supabase
        .from('prospects')
        .select(`
            *,
            target_sap:core_services(id, name),
            assigned_profile:profiles(id, full_name),
            niche:outreach_niches(id, name),
            active_sequence:outreach_sequences(id, name, status)
        `)
        .order('created_at', { ascending: false });

    if (error) throw error;
    state.prospects = data || [];
    return state.prospects;
}

export async function upsertProspect(payload) {
    const isNew = !payload.id;
    const { data, error } = isNew
        ? await supabase.from('prospects').insert(payload).select().single()
        : await supabase.from('prospects').update(payload).eq('id', payload.id).select().single();

    if (error) throw error;

    if (!state.prospects) state.prospects = [];
    const idx = state.prospects.findIndex(p => p.id === data.id);
    if (idx >= 0) state.prospects[idx] = data;
    else state.prospects.unshift(data);

    return data;
}

export async function deleteProspect(id) {
    const { error } = await supabase.from('prospects').delete().eq('id', id);
    if (error) throw error;
    state.prospects = (state.prospects || []).filter(p => p.id !== id);
}

export async function moveProspectStage(id, newStage) {
    const prospect = (state.prospects || []).find(p => p.id === id);
    const history = prospect?.stage_history || [];
    const updatedHistory = [...history, { stage: newStage, entered_at: new Date().toISOString() }];

    return upsertProspect({ id, pipeline_stage: newStage, stage_history: updatedHistory });
}

export async function fetchSapServicesForSales() {
    if (state.sapServices && state.sapServices.length > 0) return state.sapServices;
    const { data, error } = await supabase
        .from('core_services')
        .select('id, name, category')
        .eq('is_active', true)
        .order('name');
    if (error) throw error;
    state.sapServices = data || [];
    return state.sapServices;
}

// ═══════════════════════════════════════════════════════════════════════════
// NICHES (Phase 2)
// ═══════════════════════════════════════════════════════════════════════════

export async function fetchNiches() {
    const { data, error } = await supabase
        .from('outreach_niches')
        .select(`
            *,
            target_sap:core_services(id, name)
        `)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function upsertNiche(payload) {
    const isNew = !payload.id;
    const { data, error } = isNew
        ? await supabase.from('outreach_niches').insert(payload).select().single()
        : await supabase.from('outreach_niches').update(payload).eq('id', payload.id).select().single();
    if (error) throw error;
    return data;
}

export async function deleteNiche(id) {
    const { error } = await supabase.from('outreach_niches').delete().eq('id', id);
    if (error) throw error;
}

// ═══════════════════════════════════════════════════════════════════════════
// SEQUENCES + STEPS (Phase 2)
// ═══════════════════════════════════════════════════════════════════════════

export async function fetchSequences(nicheId = null) {
    let q = supabase
        .from('outreach_sequences')
        .select(`
            *,
            niche:outreach_niches(id, name),
            target_sap:core_services(id, name)
        `)
        .order('created_at', { ascending: false });
    if (nicheId) q = q.eq('niche_id', nicheId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function fetchSequenceWithSteps(sequenceId) {
    const { data: seq, error: e1 } = await supabase
        .from('outreach_sequences')
        .select(`*, niche:outreach_niches(id, name), target_sap:core_services(id, name)`)
        .eq('id', sequenceId)
        .single();
    if (e1) throw e1;

    const { data: steps, error: e2 } = await supabase
        .from('outreach_steps')
        .select('*')
        .eq('sequence_id', sequenceId)
        .order('step_number', { ascending: true });
    if (e2) throw e2;

    return { ...seq, steps: steps || [] };
}

export async function upsertSequence(payload) {
    const isNew = !payload.id;
    const { data, error } = isNew
        ? await supabase.from('outreach_sequences').insert(payload).select().single()
        : await supabase.from('outreach_sequences').update(payload).eq('id', payload.id).select().single();
    if (error) throw error;
    return data;
}

export async function deleteSequence(id) {
    const { error } = await supabase.from('outreach_sequences').delete().eq('id', id);
    if (error) throw error;
}

export async function upsertStep(payload) {
    const isNew = !payload.id;
    const { data, error } = isNew
        ? await supabase.from('outreach_steps').insert(payload).select().single()
        : await supabase.from('outreach_steps').update(payload).eq('id', payload.id).select().single();
    if (error) throw error;
    return data;
}

export async function deleteStep(id) {
    const { error } = await supabase.from('outreach_steps').delete().eq('id', id);
    if (error) throw error;
}

// ═══════════════════════════════════════════════════════════════════════════
// DISCOVERY NOTES (Phase 2)
// ═══════════════════════════════════════════════════════════════════════════

export async function fetchDiscoveryNotes(prospectId) {
    const { data, error } = await supabase
        .from('prospect_discovery_notes')
        .select('*')
        .eq('prospect_id', prospectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    return data;
}

export async function upsertDiscoveryNotes(payload) {
    const isNew = !payload.id;
    const { data, error } = isNew
        ? await supabase.from('prospect_discovery_notes').insert(payload).select().single()
        : await supabase.from('prospect_discovery_notes').update(payload).eq('id', payload.id).select().single();
    if (error) throw error;
    return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// SENDS + REPLIES (Phase 2 — usate dal Sequence Engine)
// ═══════════════════════════════════════════════════════════════════════════

export async function fetchSendsForProspect(prospectId) {
    const { data, error } = await supabase
        .from('outreach_sends')
        .select(`*, step:outreach_steps(step_number, channel, step_type)`)
        .eq('prospect_id', prospectId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function fetchRepliesForProspect(prospectId) {
    const { data, error } = await supabase
        .from('outreach_replies')
        .select('*')
        .eq('prospect_id', prospectId)
        .order('received_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function insertReply(payload) {
    const { data, error } = await supabase.from('outreach_replies').insert(payload).select().single();
    if (error) throw error;
    return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// DOMINI OUTREACH (Phase 2 — usata dall'engine SES)
// ═══════════════════════════════════════════════════════════════════════════

export async function fetchOutreachDomains() {
    const { data, error } = await supabase
        .from('outreach_domains')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function upsertOutreachDomain(payload) {
    const isNew = !payload.id;
    const { data, error } = isNew
        ? await supabase.from('outreach_domains').insert(payload).select().single()
        : await supabase.from('outreach_domains').update(payload).eq('id', payload.id).select().single();
    if (error) throw error;
    return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// COSTANTI
// ═══════════════════════════════════════════════════════════════════════════

export const PIPELINE_STAGES = [
    { key: 'cold',           label: 'Cold',             icon: 'ac_unit',         color: '#94a3b8' },
    { key: 'contacted',      label: 'Contatto inviato', icon: 'send',             color: '#3b82f6' },
    { key: 'replied',        label: 'Risposto',          icon: 'reply',            color: '#f59e0b' },
    { key: 'proposal_sent',  label: 'Proposta inviata', icon: 'description',      color: '#8b5cf6' },
    { key: 'converted',      label: 'Convertito',        icon: 'check_circle',     color: '#10b981' },
];

export const FUNNEL_SEGMENTS = [
    { key: 'cold',             label: 'Freddo',              color: '#94a3b8' },
    { key: 'discovery_done',   label: 'Discovery fatta',     color: '#f59e0b' },
    { key: 'sales_call_done',  label: 'Sales Call fatta',    color: '#8b5cf6' },
    { key: 'won',              label: 'Cliente',             color: '#10b981' },
    { key: 'lost',             label: 'Perso',               color: '#ef4444' },
];

export const ACQUISITION_SOURCES = [
    { key: 'outreach',       label: 'Outreach' },
    { key: 'referral',       label: 'Passaparola' },
    { key: 'inbound',        label: 'Inbound' },
    { key: 'event',          label: 'Evento' },
    { key: 'ambassador',     label: 'Ambassador' },
    { key: 'paid_ad',        label: 'Paid Ads' },
    { key: 'partnership',    label: 'Partnership' },
    { key: 'content',        label: 'Content Marketing' },
    { key: 'other',          label: 'Altro' },
];

export const STEP_CHANNELS = [
    { key: 'email',         label: 'Email',          icon: 'mail' },
    { key: 'dm_linkedin',   label: 'DM LinkedIn',    icon: 'link' },
    { key: 'dm_instagram',  label: 'DM Instagram',   icon: 'photo_camera' },
    { key: 'loom',          label: 'Loom video',     icon: 'videocam' },
    { key: 'whatsapp',      label: 'WhatsApp',       icon: 'chat' },
    { key: 'cold_call',     label: 'Cold call',      icon: 'call' },
];

export const STEP_TYPES = [
    { key: 'initial',          label: 'Primo contatto',           defaultDelay: 0 },
    { key: 'followup_light',   label: 'Follow-up leggero',        defaultDelay: 2 },
    { key: 'followup_value',   label: 'Follow-up con valore',     defaultDelay: 5 },
    { key: 'followup_gif',     label: 'Follow-up con GIF/meme',   defaultDelay: 10 },
    { key: 'final_close',      label: 'Chiusura finale',          defaultDelay: 15 },
];

export const TONES = [
    { key: 'professionale', label: 'Professionale' },
    { key: 'diretto',       label: 'Diretto & conciso' },
    { key: 'creativo',      label: 'Creativo & curioso' },
    { key: 'amichevole',    label: 'Amichevole' },
];

export const REPLY_CLASSIFICATIONS = [
    { key: 'hot',              label: 'Hot — pronto', color: '#10b981', priority: 1 },
    { key: 'warm',             label: 'Warm — interessato', color: '#f59e0b', priority: 2 },
    { key: 'objection_price',  label: 'Obiezione prezzo', color: '#8b5cf6', priority: 3 },
    { key: 'objection_timing', label: 'Obiezione tempi', color: '#3b82f6', priority: 4 },
    { key: 'objection_trust',  label: 'Obiezione fiducia', color: '#6366f1', priority: 5 },
    { key: 'cold',             label: 'Cold — non ora', color: '#94a3b8', priority: 6 },
    { key: 'not_interested',   label: 'Non interessato', color: '#64748b', priority: 7 },
    { key: 'unsubscribe',      label: 'Unsubscribe', color: '#ef4444', priority: 8 },
    { key: 'out_of_office',    label: 'Fuori sede', color: '#cbd5e1', priority: 9 },
    { key: 'auto_reply',       label: 'Risposta automatica', color: '#cbd5e1', priority: 10 },
];
