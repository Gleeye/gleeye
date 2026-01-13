import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface GoogleCalendarConfigProps {
    onBack: () => void;
}

export default function GoogleCalendarConfig({ onBack }: GoogleCalendarConfigProps) {
    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadConfig();
    }, []);

    async function loadConfig() {
        try {
            const { data, error } = await supabase
                .from('system_config')
                .select('key, value')
                .in('key', ['google_client_id', 'google_client_secret']);

            if (error) throw error;

            if (data) {
                const idConfig = data.find(c => c.key === 'google_client_id');
                const secretConfig = data.find(c => c.key === 'google_client_secret');

                setClientId(idConfig?.value || '');
                setClientSecret(secretConfig?.value || '');
            }
        } catch (err: any) {
            console.error('Failed to load config:', err);
            setMessage({ type: 'error', text: 'Errore nel caricamento: ' + (err.message || JSON.stringify(err)) });
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        setSaving(true);
        setMessage(null);

        try {
            // Save both values
            await supabase
                .from('system_config')
                .upsert([
                    { key: 'google_client_id', value: clientId, description: 'Google OAuth Client ID for Calendar API' },
                    { key: 'google_client_secret', value: clientSecret, description: 'Google OAuth Client Secret for Calendar API' }
                ], { onConflict: 'key' });

            setMessage({ type: 'success', text: 'Configurazione salvata con successo!' });
        } catch (err: any) {
            console.error('Failed to save config:', err);
            setMessage({ type: 'error', text: 'Errore nel salvataggio: ' + err.message });
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="animate-fade-in max-w-3xl mx-auto p-6">
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                    <p className="mt-4 text-slate-500">Caricamento...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in max-w-3xl mx-auto p-6">
            <button
                onClick={onBack}
                className="mb-6 flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-medium"
            >
                <ArrowLeft className="w-4 h-4" /> Torna alla Dashboard
            </button>

            <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Configurazione Google Calendar</h2>
                    <p className="text-slate-600">
                        Inserisci le credenziali OAuth per abilitare l'integrazione con Google Calendar.
                    </p>
                </div>

                {message && (
                    <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 ${message.type === 'success'
                        ? 'bg-emerald-50 border border-emerald-200'
                        : 'bg-red-50 border border-red-200'
                        }`}>
                        {message.type === 'success' ? (
                            <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        )}
                        <p className={message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}>
                            {message.text}
                        </p>
                    </div>
                )}

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Google Client ID
                        </label>
                        <input
                            type="text"
                            value={clientId}
                            onChange={(e) => setClientId(e.target.value)}
                            placeholder="123456789-abcdefg.apps.googleusercontent.com"
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                        />
                        <p className="mt-2 text-sm text-slate-500">
                            Ottienilo dalla <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">Google Cloud Console</a>
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Google Client Secret
                        </label>
                        <input
                            type="password"
                            value={clientSecret}
                            onChange={(e) => setClientSecret(e.target.value)}
                            placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxxx"
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                        />
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                        <h4 className="font-semibold text-slate-900 mb-2 text-sm">📋 Istruzioni rapide</h4>
                        <ol className="text-sm text-slate-600 space-y-1 list-decimal list-inside">
                            <li>Vai alla <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">Google Cloud Console</a></li>
                            <li>Crea un nuovo progetto o selezionane uno esistente</li>
                            <li>Abilita la <strong>Google Calendar API</strong></li>
                            <li>Crea credenziali OAuth 2.0 (tipo "Web application")</li>
                            <li>Aggiungi il Redirect URI: <code className="bg-white px-2 py-0.5 rounded text-xs">{window.location.origin}</code></li>
                            <li>Copia Client ID e Client Secret qui sopra</li>
                        </ol>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            onClick={handleSave}
                            disabled={saving || !clientId || !clientSecret}
                            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold shadow-sm"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Salvataggio...' : 'Salva Configurazione'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
