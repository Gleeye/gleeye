/**
 * sales/index.js
 * Entry point per il modulo Sales Engine.
 * Phase 1: pipeline + metrics
 * Phase 2: niches (Niche Research Center + detail page)
 */

export { renderPipelineBoard } from './pipeline_board.js?v=8001';
export { renderSalesMetrics }  from './metrics.js?v=8001';
export { renderSalesNiches, renderNicheDetail } from './niches.js?v=8001';
export { renderSalesSequences, renderSequenceDetail } from './sequences.js?v=8001';
