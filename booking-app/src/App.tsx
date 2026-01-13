import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { Loader2 } from 'lucide-react';
import BookingsHub from './features/admin/BookingsHub';
import { ToastProvider } from './components/ui/Toast';
import BookingWizard from './features/user/BookingWizard';

function App() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'user' | 'admin'>('user');

  useEffect(() => {
    // Initial check
    checkUser();

    // Check for mode param (e.g. ?mode=admin)
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    if (mode === 'admin') {
      setView('admin');
    }

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      // Logic for session change handled by parent sync usually
    });

    // Listen for Session from Parent (Iframe mode)
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'SUPABASE_SESSION' && event.data?.payload) {
        console.log("Received session from parent");
        const session = event.data.payload;

        // Set session in Supabase client
        await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
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
      await supabase.auth.getSession();
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="bg-white font-sans text-slate-900">
        {/* Main Content */}
        <main className={`p-4 md:p-6 animate-fade-in ${view === 'admin' ? 'max-w-full' : 'max-w-7xl mx-auto'}`}>
          {view === 'admin' ? (
            <BookingsHub />
          ) : (
            <BookingWizard />
          )}
        </main>
      </div>
    </ToastProvider>
  );
}

export default App;
