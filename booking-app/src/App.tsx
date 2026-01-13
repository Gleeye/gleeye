import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { Settings, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import AdminDashboard from './features/admin/AdminDashboard';
import { ToastProvider } from './components/ui/Toast';
import BookingWizard from './features/user/BookingWizard';

function App() {
  const [, setSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false); // Can access backend settings
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'user' | 'admin'>('user');

  useEffect(() => {
    // Initial check
    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        checkPermissions(session.user);
      } else {
        setIsAdmin(false);
      }
    });

    // Listen for Session from Parent (Iframe mode)
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'SUPABASE_SESSION' && event.data?.payload) {
        console.log("Received session from parent");
        const session = event.data.payload;

        // Set session in Supabase client
        const { error } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });

        if (error) console.error("Error setting session", error);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  async function checkUser() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session) {
        await checkPermissions(session.user);
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function checkPermissions(user: any) {
    if (!user) return;
    console.log("Checking permissions for:", user.email);

    try {
      // 1. Check Profiles (standard role)
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role === 'admin') {
        console.log("User is admin via profile");
        setIsAdmin(true);
        return;
      }

      // 2. Check Collaborators (tags/roles)
      // Try matching by email if user_id link is not established
      const { data: collaborator } = await supabase
        .from('collaborators')
        .select('role, tags')
        .eq('email', user.email)
        .maybeSingle(); // Use maybeSingle to avoid 406 if not found

      if (collaborator) {
        const tags = (collaborator.tags || '').toLowerCase();
        const role = (collaborator.role || '').toLowerCase();

        const allowedTags = ['partner', 'account', 'project manager'];
        const hasTag = allowedTags.some(t => tags.includes(t));

        if (hasTag || role === 'admin' || role === 'manager') {
          console.log("User is admin via collaborator tags/role");
          setIsAdmin(true);
        }
      }
    } catch (err) {
      console.error("Permission check failed", err);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
        {/* Header / Top Bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 transition-all">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
              {view === 'admin' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  Booking Backend
                </>
              ) : 'Prenotazione Servizi'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => setView(view === 'admin' ? 'user' : 'admin')}
                className={`p-2 rounded-lg transition-colors border flex items-center gap-2 text-sm font-medium ${view === 'admin'
                  ? 'bg-slate-100 text-slate-700 border-slate-300 shadow-inner'
                  : 'bg-white text-slate-500 border-transparent hover:bg-slate-50 hover:text-blue-600'
                  }`}
                title={view === 'admin' ? "Torna alla vista utente" : "Impostazioni Backend"}
              >
                {view === 'admin' ? (
                  <>
                    <CalendarIcon className="w-5 h-5" />
                    <span className="hidden md:inline">Vista Utente</span>
                  </>
                ) : (
                  <>
                    <Settings className="w-5 h-5" />
                    <span className="hidden md:inline">Configura</span>
                  </>
                )}
              </button>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in">
          {view === 'admin' ? (
            <AdminDashboard />
          ) : (
            <BookingWizard />
          )}
        </main>
      </div>
    </ToastProvider>
  );
}

export default App;
