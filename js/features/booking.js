import { state } from '../modules/state.js?v=210';

export function renderBooking(container) {
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.textContent = 'Prenotazioni';

    // In production, this URL would point to the built static files (e.g., /booking/index.html)
    // In development, we point to the Vite dev server.
    const BOOKING_APP_URL = 'http://localhost:5173';

    container.innerHTML = `
        <div class="animate-fade-in" style="height: calc(100vh - 80px); width: 100%; overflow: hidden; border-radius: 12px; background: white; box-shadow: var(--shadow-sm);">
            <iframe 
                id="booking-iframe"
                src="${BOOKING_APP_URL}" 
                style="width: 100%; height: 100%; border: none;"
                title="Booking Module"
                loading="lazy"
            ></iframe>
        </div>
    `;

    // Cross-Origin Session Sync
    setTimeout(() => {
        const iframe = document.getElementById('booking-iframe');
        if (iframe) {
            iframe.onload = () => {
                const session = localStorage.getItem('sb-whpbetjyhpttinbxcffs-auth-token');
                // Note: The key depends on Supabase client config. 
                // Checking standard local storage key first.
                // If using 'window.sb', we can get it directly.

                let sessionData = null;
                if (window.sb && window.sb.auth && window.sb.auth.session) {
                    sessionData = window.sb.auth.session();
                } else if (session) {
                    try {
                        sessionData = JSON.parse(session);
                    } catch (e) { console.error('Error parsing session', e); }
                }

                if (sessionData) {
                    console.log("Sending session to Booking App...", sessionData);
                    iframe.contentWindow.postMessage({
                        type: 'SUPABASE_SESSION',
                        payload: sessionData
                    }, BOOKING_APP_URL);
                }
            };
        }
    }, 100);
}
