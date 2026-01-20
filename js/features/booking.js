import { state } from '../modules/state.js?v=148';

export function renderBooking(container) {
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.textContent = 'Prenotazioni';

    // Use localhost in development, Vercel in production
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const BOOKING_APP_URL = isLocal ? 'http://localhost:5173' : 'https://gleeyebooking.vercel.app';

    container.innerHTML = `
        <div class="animate-fade-in" style="height: calc(100vh - 80px); width: 100%; overflow: hidden; border-radius: 12px; background: white; box-shadow: var(--shadow-sm);">
            <iframe 
                id="booking-iframe"
                src="${BOOKING_APP_URL}?mode=admin&c=${Date.now()}" 
                style="width: 100%; height: 100%; border: none;"
                title="Booking Module"
                loading="lazy"
            ></iframe>
        </div>
    `;

    // Cross-Origin Session Sync
    setTimeout(async () => {
        const iframe = document.getElementById('booking-iframe');
        if (iframe) {
            iframe.onload = async () => {
                let sessionData = null;

                // 1. Try to get session from global supabase client (v2 API)
                if (window.sb && window.sb.auth) {
                    const { data } = await window.sb.auth.getSession();
                    sessionData = data?.session;
                }

                // 2. Fallback to localStorage if client fails
                if (!sessionData) {
                    const storageKey = 'sb-whpbetjyhpttinbxcffs-auth-token';
                    const sessionStr = localStorage.getItem(storageKey);
                    if (sessionStr) {
                        try {
                            sessionData = JSON.parse(sessionStr);
                        } catch (e) {
                            console.error('Error parsing session from storage', e);
                        }
                    }
                }

                if (sessionData) {
                    console.log("Sending session to Booking App...", sessionData);
                    iframe.contentWindow.postMessage({
                        type: 'SUPABASE_SESSION',
                        payload: sessionData
                    }, BOOKING_APP_URL);
                } else {
                    console.warn("No session found to sync with Booking App");
                }
            };
        }
    }, 100);
}
