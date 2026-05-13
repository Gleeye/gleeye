/**
 * sales/api.js
 * Fetch / upsert / delete per prospects e pipeline sales.
 */

import { supabase } from '../../modules/config.js?v=8000';
import { state }    from '../../modules/state.js?v=8000';

// ─── PROSPECTS ────────────────────────────────────────────────────────────────

export async function fetchProspects() {
    const { data, error } = await supabase
        .from('prospects')
        .select(`
            *,
            target_sap:core_services(id, name),
            assigned_profile:profiles(id, full_name)
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

// ─── COSTANTI PIPELINE ────────────────────────────────────────────────────────

export const PIPELINE_STAGES = [
    { key: 'cold',           label: 'Cold',             icon: 'ac_unit',         color: '#94a3b8' },
    { key: 'contacted',      label: 'Contatto inviato', icon: 'send',             color: '#3b82f6' },
    { key: 'replied',        label: 'Risposto',          icon: 'reply',            color: '#f59e0b' },
    { key: 'proposal_sent',  label: 'Proposta inviata', icon: 'description',      color: '#8b5cf6' },
    { key: 'converted',      label: 'Convertito',        icon: 'check_circle',     color: '#10b981' },
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
