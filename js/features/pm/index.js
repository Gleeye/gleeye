// 1. Update PM Index imports
import { renderCommesseList } from './commesse_list.js?v=151';
import { renderInternalProjects } from './internal_list.js?v=151';
import { renderMyWork } from './my_work.js?v=151';
import { renderSpaceView } from './space_view.js?v=151';
import { state } from '../../modules/state.js?v=151';

export function renderPM(container) {
    const subPage = state.currentSubPage;
    const id = state.currentId;
    console.log("Rendering PM Module:", subPage, id);
    switch (subPage) {
        case 'commesse': renderCommesseList(container); break;
        case 'interni': renderInternalProjects(container); break;
        case 'my-work': renderMyWork(container); break;
        case 'space': id ? renderSpaceView(container, id) : (container.innerHTML = '<p style=\"padding:2rem;color:red;\">ID Progetto mancante.</p>'); break;
        default: container.innerHTML = `<div style=\"padding:2rem;\"><h3>Project Management</h3><p>Seleziona una voce dal menu laterale.</p></div>`;
    }
}
