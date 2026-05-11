// Quick status actions on orders (delete, change offer_status, change status_works).
// Extracted from orders.js. Side effects on import only:
//   - window.deleteOrder(id)
//   - window.updateOrderOfferStatusQuick(id, newStatus)
//   - window.updateOrderStatusQuick(id, newStatus)
//
// Note: renderOrderDetail is referenced via window.location.hash + global,
//        no import needed.

import { showGlobalAlert, showConfirm } from '../../modules/utils.js?v=8000';
import { updateOrder, deleteOrder } from '../../modules/api.js?v=8000';

window.deleteOrder = async (id) => {
    const confirm = await showConfirm("Sei sicuro di voler eliminare questo ordine? L'operazione non può essere annullata.", "Elimina Ordine");
    if (!confirm) return;

    try {
        await deleteOrder(id);
        showGlobalAlert("Ordine eliminato con successo");
        window.location.hash = "orders";
    } catch (e) {
        showGlobalAlert("Errore durante l'eliminazione: " + e.message, "error");
    }
};

window.updateOrderOfferStatusQuick = async (id, newStatus) => {
    try {
        await updateOrder(id, { offer_status: newStatus });
        showGlobalAlert("Stato offerta aggiornato");
        // Re-render via hash to avoid cyclic import with orders.js
        window.location.hash = '#order-detail/' + id;
    } catch (e) {
        showGlobalAlert("Errore aggiornamento: " + e.message, "error");
    }
};

window.updateOrderStatusQuick = async (id, newStatus) => {
    try {
        await updateOrder(id, { status_works: newStatus });
        showGlobalAlert("Stato aggiornato");
        // Re-render to update UI (specifically the badge color/text if needed, 
        // though the select itself stays in place)
        // Re-render via hash to avoid cyclic import with orders.js
        window.location.hash = '#order-detail/' + id;
    } catch (e) {
        showGlobalAlert("Errore aggiornamento stato: " + e.message, "error");
    }
};
