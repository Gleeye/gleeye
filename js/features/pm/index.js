// 1. Update PM Index imports
import { renderCommesseList } from './commesse_list.js?v=157';
import { renderInternalProjects } from './internal_list.js?v=157';
import { renderMyWork } from './my_work.js?v=157';
import { renderSpaceView } from './space_view.js?v=157';
import { state } from '../../modules/state.js?v=157';

export function renderPM(container) {
    const subPage = state.currentSubPage;
    const id = state.currentId;
    console.log("Rendering PM Module:", subPage, id);
    console.log("Full state.currentSubPage:", state.currentSubPage);
    console.log("Location Hash:", window.location.hash);
    if (!subPage) {
        console.log("No subPage detected, redirecting to commesse");
        window.location.hash = '#pm/commesse';
        return;
    }

    switch (subPage) {
        case 'commesse': renderCommesseList(container); break;
        case 'interni': renderInternalProjects(container); break;
        case 'my-work': renderMyWork(container); break;
        case 'space': id ? renderSpaceView(container, id) : (container.innerHTML = '<p style=\"padding:2rem;color:red;\">ID Progetto mancante.</p>'); break;
        default: container.innerHTML = `<div style=\"padding:2rem;\"><h3>Project Management</h3><p>Seleziona una voce dal menu laterale.</p></div>`;
    }
}
