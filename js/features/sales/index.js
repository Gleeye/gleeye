/**
 * sales/index.js
 * Entry point per il modulo Sales Engine.
 * Phase 1: pipeline + metrics
 * Phase 2: niches (Niche Research Center + detail page)
 */

export { renderPipelineBoard } from './pipeline_board.js?v=8003';
export { renderSalesMetrics }  from './metrics.js?v=8001';
export { renderSalesNiches } from './niches.js?v=8002';
export { renderNicheDetail } from './niche_detail.js?v=8001';
export { renderSalesSequences, renderSequenceDetail } from './sequences.js?v=8001';
export { renderProspectsView } from './prospects_view.js?v=8001';
