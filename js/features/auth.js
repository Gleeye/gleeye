import { supabase } from '../modules/config.js?v=123';
import { state } from '../modules/state.js?v=123';
import { fetchProfile, fetchClients, fetchOrders, fetchCollaborators, fetchAllProfiles, fetchInvoices, fetchPassiveInvoices, fetchSuppliers, fetchDepartments, fetchContacts, fetchBankTransactions, fetchTransactionCategories, fetchServices, fetchCollaboratorServices, fetchAssignments, fetchPayments } from '../modules/api.js?v=123';
import { showGlobalAlert } from '../modules/utils.js?v=123';
import { updateSidebarVisibility } from './layout.js?v=123';

// We need a way to call router() from here. 
// Since router depends on render which depends on auth state, we might have a cycle.
// We will assign the router function to window.router or pass it in init.
// For now, let's assume app.js exposes it or we dispatch an event.
// Using a global event 'hashchange' is standard for router, but for initial load?
// We can dispatch a custom event 'auth:success'.

export function initAuth() {
    // Inject HTML
    if (!document.getElementById('auth-container')) {
        document.body.insertAdjacentHTML('afterbegin', `
            <div id="auth-container" class="auth-container hidden">
                <div class="auth-blob blob-1"></div>
                <div class="auth-blob blob-2"></div>
                <div class="auth-card">
                    <div class="brand">
                        <img src="logo_gleeye_new.png" alt="Gleeye Logo" class="brand-logo">
                    </div>
                    <h2>Bentornato</h2>
                    <p>Inserisci la tua email per ricevere un Magic Link di accesso.</p>
                    <form id="login-form">
                        <div class="input-group">
                            <span class="material-icons-round">email</span>
                            <input type="email" id="login-email" placeholder="email@azienda.com" required>
                        </div>
                        <div class="input-group" id="password-group">
                            <span class="material-icons-round">lock</span>
                            <input type="password" id="login-password" placeholder="Password">
                        </div>
                        <button type="submit" id="login-btn" class="primary-btn">Accedi</button>
                        <div class="auth-options">
                            <a href="#" id="toggle-magic-link">Usa Magic Link</a>
                        </div>
                    </form>
                    <div id="auth-message" class="auth-message"></div>
                </div>
            </div>

            <div id="set-password-container" class="auth-container hidden">
                <div class="auth-blob blob-1"></div>
                <div class="auth-blob blob-2"></div>
                <div class="auth-card">
                    <div class="brand">
                        <img src="logo_gleeye_new.png" alt="Gleeye Logo" class="brand-logo">
                    </div>
                    <h2>Imposta Password</h2>
                    <p>Completa il tuo primo accesso impostando una password sicura.</p>
                    <form id="set-password-form">
                        <div class="input-group">
                            <span class="material-icons-round">lock</span>
                            <input type="password" id="new-password" placeholder="Nuova Password" required minlength="6">
                        </div>
                        <button type="submit" id="set-password-btn" class="primary-btn">Salva e Accedi</button>
                    </form>
                    <div id="set-password-message" class="auth-message"></div>
                </div>
            </div>
        `);
    }

    // Listeners
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    const magicLinkToggle = document.getElementById('toggle-magic-link');
    if (magicLinkToggle) magicLinkToggle.addEventListener('click', toggleAuthMode);

    const setPasswordForm = document.getElementById('set-password-form');
    if (setPasswordForm) setPasswordForm.addEventListener('submit', handleSetPassword);

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    // Reset fetching state
    state.isFetching = false;
    checkSession();
}

export async function checkSession() {
    try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        console.log("Session status:", data?.session ? "Logged in" : "Guest");
        handleSession(data?.session);
    } catch (err) {
        console.error("Auth error:", err);
        handleSession(null);
    }

    supabase.auth.onAuthStateChange((_event, session) => {
        handleSession(session);
    });
}

async function handleSession(session) {
    state.session = session;
    const authContainer = document.getElementById('auth-container');
    const setPasswordContainer = document.getElementById('set-password-container');
    const appContainer = document.getElementById('app');

    // Reset visibility - keep app hidden until fully ready
    if (authContainer) authContainer.classList.add('hidden');
    if (setPasswordContainer) setPasswordContainer.classList.add('hidden');
    if (appContainer) appContainer.classList.add('hidden');


    if (session) {
        // Fetch profile first to determine onboarding status
        const profile = await fetchProfile();

        if (profile && !profile.is_onboarded) {
            // First access: Show Set Password Screen
            if (setPasswordContainer) setPasswordContainer.classList.remove('hidden');
        } else {
            // Normal access: Show Dashboard
            console.log("Session valid, loading app data...");

            // CRITICAL: Update sidebar visibility BEFORE showing app
            // This prevents collaborators from seeing admin elements
            updateSidebarVisibility();

            // For collaborators: ensure we redirect to allowed page BEFORE showing app
            const activeRole = state.impersonatedRole || state.profile?.role || 'collaborator';
            const allowedPagesForCollaborator = ['booking', 'profile', 'agenda', 'my-assignments'];
            const currentHash = window.location.hash.slice(1) || 'dashboard';
            const [currentPage] = currentHash.split('/');

            console.log(`[Auth] User Role: ${activeRole}, Profile Role: ${state.profile?.role}, Current Page: ${currentPage}`);

            if (activeRole !== 'admin' && !allowedPagesForCollaborator.includes(currentPage)) {
                // Redirect BEFORE showing anything - no flash
                console.log(`[Auth] Collaborator on restricted page '${currentPage}', redirecting to booking...`);
                window.location.hash = 'booking';
            }

            // NOW show the app (with correct sidebar visibility already set)
            if (appContainer) appContainer.classList.remove('hidden');

            // Load initial data
            if (state.isFetching) return;
            state.isFetching = true;

            const dataFetches = [
                fetchClients(),
                fetchOrders(),
                fetchCollaborators(),
                fetchAllProfiles(),
                fetchInvoices(),
                fetchPassiveInvoices(),
                fetchSuppliers(),
                fetchDepartments(),
                fetchContacts(),
                fetchBankTransactions(),
                fetchTransactionCategories(),
                fetchServices(),
                fetchCollaboratorServices(),
                fetchAssignments(),
                fetchPayments()
            ];

            Promise.all(dataFetches.map(p => p.catch(e => console.error("Fetch error:", e))))
                .then(() => {
                    console.log("[Auth] All data fetched. Triggering app:ready");
                    state.isFetching = false;
                    window.dispatchEvent(new Event('app:ready'));
                });
        }
    } else {
        console.log("No session found, showing login.");
        if (authContainer) authContainer.classList.remove('hidden');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    const msg = document.getElementById('auth-message');

    btn.textContent = 'Caricamento...';
    btn.disabled = true;
    msg.textContent = '';
    msg.className = 'auth-message';

    try {
        let result;
        if (state.authMode === 'magic') {
            result = await supabase.auth.signInWithOtp({
                email,
                options: {
                    shouldCreateUser: true,
                    emailRedirectTo: window.location.origin
                }
            });
            if (result.error) throw result.error;
            msg.textContent = 'Ti abbiamo inviato un Magic Link via email!';
            msg.classList.add('success');
        } else {
            result = await supabase.auth.signInWithPassword({ email, password });
            if (result.error) throw result.error;
            // Auth state change will handle the rest
        }
    } catch (error) {
        console.error("Login error:", error);
        msg.textContent = 'Errore: ' + (error.message === 'Invalid login credentials' ? 'Credenziali non valide.' : error.message);
        msg.classList.add('error');
    } finally {
        btn.textContent = 'Accedi';
        btn.disabled = false;
    }
}

function toggleAuthMode(e) {
    e.preventDefault();
    state.authMode = state.authMode === 'password' ? 'magic' : 'password';
    const passwordGroup = document.getElementById('password-group');
    const title = document.querySelector('#auth-container h2');
    const text = document.querySelector('#auth-container p');
    const link = document.getElementById('toggle-magic-link');

    if (state.authMode === 'magic') {
        passwordGroup.classList.add('hidden');
        document.getElementById('login-password').removeAttribute('required');
        title.textContent = 'Magic Link';
        text.textContent = 'Ti invieremo un link per accedere senza password.';
        link.textContent = 'Usa Password';
    } else {
        passwordGroup.classList.remove('hidden');
        document.getElementById('login-password').setAttribute('required', 'true');
        title.textContent = 'Bentornato';
        text.textContent = 'Inserisci la tua email per accedere.';
        link.textContent = 'Usa Magic Link';
    }
}

async function handleSetPassword(e) {
    e.preventDefault();
    const newPassword = document.getElementById('new-password').value;
    const btn = document.getElementById('set-password-btn');
    const msg = document.getElementById('set-password-message');

    if (newPassword.length < 6) {
        msg.textContent = 'La password deve avere almeno 6 caratteri.';
        msg.classList.add('error');
        return;
    }

    btn.textContent = 'Salvataggio...';
    btn.disabled = true;

    try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;

        // Update profile to onboarded
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ is_onboarded: true })
            .eq('id', state.session.user.id);

        if (profileError) throw profileError;

        // Refresh session to trigger main app load
        window.location.reload();
    } catch (error) {
        console.error("Set password error:", error);
        msg.textContent = 'Errore: ' + error.message;
        msg.classList.add('error');
        btn.textContent = 'Salva e Accedi';
        btn.disabled = false;
    }
}

async function handleLogout() {
    // Clear saved route so next login starts fresh
    sessionStorage.removeItem('gleeye_current_route');
    await supabase.auth.signOut();
    window.location.reload();
}
