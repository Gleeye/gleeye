import { updateDocMetadata, updateDocPage } from '../../modules/docs_api.js';

let excalidrawScriptLoaded = false;
let saveTimeout = null;
let currentRoot = null;

/**
 * Loads React, ReactDOM (UMD), and Excalidraw from CDN dynamically.
 * Uses sequential loading to ensure React internals are available for ReactDOM.
 */
async function loadExcalidraw() {
    if (excalidrawScriptLoaded) return;

    const loadScript = (src) => {
        return new Promise((res, rej) => {
            const script = document.createElement('script');
            script.src = src;
            script.crossOrigin = 'anonymous';
            script.async = false; // Important for execution order in some browsers
            script.onload = res;
            script.onerror = (e) => {
                console.error(`Failed to load script: ${src}`, e);
                rej(e);
            };
            document.head.appendChild(script);
        });
    };

    try {
        // Step 1: Load React first (Essential for ReactDOM internals)
        await loadScript('https://cdn.jsdelivr.net/npm/react@18.2.0/umd/react.production.min.js');

        // Step 2: Load ReactDOM only after React is ready
        await loadScript('https://cdn.jsdelivr.net/npm/react-dom@18.2.0/umd/react-dom.production.min.js');

        // Step 3: Set Asset Path and Load Excalidraw
        window.EXCALIDRAW_ASSET_PATH = "https://cdn.jsdelivr.net/npm/@excalidraw/excalidraw@0.17.3/dist/";
        await loadScript('https://cdn.jsdelivr.net/npm/@excalidraw/excalidraw@0.17.3/dist/excalidraw.production.min.js');

        excalidrawScriptLoaded = true;
    } catch (err) {
        console.error("Critical error loading Whiteboard dependencies:", err);
        throw err;
    }
}

export async function renderWhiteboardEditor(container, page) {
    container.innerHTML = '<div class="loading-state" style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc;">' +
        '<div class="loader"></div>' +
        '<p style="margin-top: 20px; color: #64748b; font-family: sans-serif;">Caricamento lavagna...</p>' +
        '</div>';

    try {
        await loadExcalidraw();
    } catch (e) {
        container.innerHTML = `<div style="padding: 40px; text-align: center; color: #ef4444; font-family: sans-serif;">
            <h3>Errore di connessione</h3>
            <p>Non è stato possibile caricare i componenti della lavagna. Riprova tra poco.</p>
        </div>`;
        return;
    }

    container.innerHTML = '';

    // UI Setup
    const mainWrapper = document.createElement('div');
    mainWrapper.style.cssText = 'width:100%; height:100%; display:flex; flex-direction:column; overflow:hidden;';
    container.appendChild(mainWrapper);

    // Header
    const headerRow = document.createElement('div');
    headerRow.style.cssText = 'padding:8px 16px; display:flex; align-items:center; background:#ffffff; border-bottom:1px solid #e2e8f0; height:48px; flex-shrink:0;';

    const titleInput = document.createElement('input');
    titleInput.value = page.title || 'Nuova Whiteboard';
    titleInput.placeholder = "Titolo lavagna...";
    titleInput.style.cssText = 'font-size:16px; font-weight:600; border:none; outline:none; color:#1e293b; flex:1; background:transparent; padding:4px 8px; font-family:inherit;';

    titleInput.onblur = async () => {
        if (titleInput.value !== page.title && titleInput.value.trim() !== '') {
            await updateDocPage(page.id, { title: titleInput.value });
            page.title = titleInput.value;
            document.dispatchEvent(new CustomEvent('doc-page-updated', { detail: { pageId: page.id } }));
        }
    };

    headerRow.appendChild(titleInput);
    mainWrapper.appendChild(headerRow);

    // Canvas
    const canvasContainer = document.createElement('div');
    canvasContainer.id = 'excalidraw-rendering-target';
    canvasContainer.style.cssText = 'flex:1; width:100%; position:relative;';
    mainWrapper.appendChild(canvasContainer);

    // Initial Data
    let initialData = {
        appState: { zenModeEnabled: false, viewBackgroundColor: "#ffffff", scrollToContent: true }
    };
    if (page.metadata && page.metadata.elements) {
        initialData.elements = page.metadata.elements;
        if (page.metadata.appState) {
            initialData.appState = { ...initialData.appState, ...page.metadata.appState };
        }
    }

    const ExcalidrawApp = () => {
        return React.createElement(ExcalidrawLib.Excalidraw, {
            initialData: initialData,
            langCode: "it-IT",
            UIOptions: {
                canvasActions: {
                    toggleTheme: true,
                    saveAsImage: true,
                    clearCanvas: true,
                    export: false,
                    loadScene: false
                }
            },
            onChange: (elements, appState) => {
                if (saveTimeout) clearTimeout(saveTimeout);
                saveTimeout = setTimeout(async () => {
                    try {
                        const safeAppState = {
                            viewBackgroundColor: appState.viewBackgroundColor,
                            zoom: appState.zoom
                        };
                        await updateDocMetadata(page.id, {
                            elements: elements.filter(el => !el.isDeleted),
                            appState: safeAppState
                        });
                    } catch (err) {
                        console.error("Save error:", err);
                    }
                }, 2500);
            }
        });
    };

    // Robust Render logic for iPad/Safari
    try {
        const reactElement = React.createElement(ExcalidrawApp);

        if (typeof ReactDOM.createRoot === 'function') {
            // Modern React 18
            if (!currentRoot) {
                currentRoot = ReactDOM.createRoot(canvasContainer);
            }
            currentRoot.render(reactElement);
        } else {
            // Legacy Fallback (older Safari/iPad might behave better with this)
            ReactDOM.render(reactElement, canvasContainer);
        }
    } catch (err) {
        console.error("Render failed:", err);
        // Desperate last attempt
        if (window.ReactDOM && window.ReactDOM.render) {
            window.ReactDOM.render(React.createElement(ExcalidrawApp), canvasContainer);
        }
    }
}
