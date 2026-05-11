import re

file_path = "/Users/davidegentile/Documents/app dev/gleeye erp/js/features/homepage-alt.js"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

start_marker = "<!-- 2. MAIN CONTENT AREA (Projects + Activities) -->"
end_marker = "<!-- 3. MOBILE OVERLAY POPUP (Replica of Desktop Sidebar) -->"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Markers not found!")
    exit(1)

new_content = """<!-- 2. MAIN CONTENT AREA (Projects + Activities) -->
            <div class="hp-main-content-area custom-scrollbar" style="padding-top: 1rem;">
                 
                 <!-- RESPONSIVE DASHBOARD STYLES -->
                 <style>
                     .hp-dash-collab-top, .hp-dash-collab-fin, .hp-dash-partner-main {
                         display: flex;
                         gap: 2.5rem;
                         align-items: flex-start;
                         width: 100%;
                     }
                     .hp-dash-collab-top > :nth-child(1) { flex: 0.9; }
                     .hp-dash-collab-top > :nth-child(2) { flex: 1.15; }
                     .hp-dash-collab-fin > div { flex: 1; }
                     .hp-dash-partner-main > :nth-child(1) { flex: 1.1; max-width: 850px; }
                     .hp-dash-partner-main > :nth-child(2) { flex: 0.9; }
                     .hp-dash-partner-main > :nth-child(3) { flex: 1; min-width: 260px; }

                     @media (max-width: 1100px) {
                         .hp-dash-collab-top, .hp-dash-collab-fin, .hp-dash-partner-main {
                             flex-direction: column;
                         }
                         .hp-dash-collab-top > div, .hp-dash-collab-fin > div, .hp-dash-partner-main > div {
                             flex: none !important;
                             width: 100% !important;
                             max-width: 100% !important;
                             min-width: 0 !important;
                         }
                     }
                 </style>

                 <!-- MOBILE STICKY BANNER -->
                 <div class="hp-mobile-banner" onclick="window.openMobileAgenda()">
                    <div style="display: flex; align-items: center; gap: 14px;">
                        <div style="display: flex; flex-direction: column; gap: 0;">
                            <span style="font-size: 0.62rem; font-weight: 800; color: #1e293b; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 2px;">JOURNAL'S VIEW</span>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="display: flex; align-items: center; gap: 4px;">
                                    <span class="material-icons-round" style="color: #8b5cf6; font-size: 13px;">task_alt</span>
                                    <span id="hp-banner-count-tasks" style="font-weight: 800; font-size: 0.9rem; color: #64748b;">0</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 4px;">
                                    <span class="material-icons-round" style="color: #10b981; font-size: 13px;">calendar_today</span>
                                    <span id="hp-banner-count-events" style="font-weight: 800; font-size: 0.9rem; color: #64748b;">0</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div onclick="event.stopPropagation(); window.toggleHpQuickEntry(this)" style="width: 36px; height: 36px; background: #1e293b; border: none; border-radius: 11px; color: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 15px rgba(0,0,0,0.15); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        <span class="material-icons-round" style="font-size: 20px;">add</span>
                    </div>
                 </div>
                 
                 <div class="hp-main-columns-container">
                     ${isCollaborator ? `
                     <!-- ==================== COLLABORATOR ==================== -->
                     <div style="flex: 2.4; display: flex; flex-direction: column; gap: 2.5rem;">
                         <!-- ROW 1: TOP BLOCKS (NO BOX - COMPACT & STABLE) -->
                         <div class="hp-dash-collab-top">
                             <!-- Left: Tasks (Collab) -->
                             <div id="hp-pm-spaces-main-block" style="display: flex; flex-direction: column; padding: 0;">
                                <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 0.75rem;">
                                     <div style="display: flex; justify-content: space-between; align-items: center;">
                                         <h3 style="font-size: 1.15rem; font-weight: 600; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 10px; letter-spacing: -0.01em;">
                                             <div style="width: 32px; height: 32px; border-radius: 10px; background: rgba(255, 255, 255, 0.6); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.5);">
                                                 <span class="material-icons-round" style="color: #64748b; font-size: 18px;">dashboard</span>
                                             </div>
                                             Riepilogo Task
                                         </h3>
                                     </div>
                                </div>
                                <div id="hp-projects-stats-bar" style="display: flex; align-items: center; justify-content: space-between; padding: 0.25rem 0.5rem; margin-bottom: 0.25rem;"></div>
                                <div id="hp-pm-spaces-main-list" class="custom-scrollbar" style="display: flex; flex-direction: column; gap: 12px; overflow-y: auto; overflow-x: hidden; padding: 0 8px 30px 0;"></div>
                             </div>

                             <!-- Right: Internal Activities (Collab) -->
                             <div id="hp-internal-dashboard-block" style="display: flex; flex-direction: column; padding: 0;">
                                <div style="margin-bottom: 1.25rem; display: flex; align-items: center; gap: 10px;">
                                    <div style="width: 32px; height: 32px; border-radius: 10px; background: rgba(255, 255, 255, 0.6); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.5);">
                                        <span class="material-icons-round" style="color: #64748b; font-size: 18px;">business_center</span>
                                    </div>
                                    <h3 style="font-size: 1.15rem; font-weight: 600; color: #1e293b; margin: 0; letter-spacing: -0.01em;">Attività interne</h3>
                                </div>
                                <div style="margin-bottom: 2rem;">
                                    <div id="hp-internal-hubs-buttons" style="display: flex; gap: 12px; overflow-x: auto; padding-bottom: 12px; scrollbar-width: none; -ms-overflow-style: none;"></div>
                                </div>
                                <div id="hp-internal-clusters-grid" class="custom-scrollbar" style="flex: 1; display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 1rem; overflow-y: auto; padding: 0 4px 2rem 4px;"></div>
                             </div>
                         </div>

                         <!-- ROW 2: FINANCIAL BLOCKS (Collab) -->
                         <div class="hp-dash-collab-fin">
                             <div id="hp-collaborator-payments-box" class="hp-widget-panel" style="display: flex; flex-direction: column; padding: 1.5rem; background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 28px; box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07);">
                                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
                                      <h3 style="font-size: 1.15rem; font-weight: 600; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 10px; letter-spacing: -0.01em;">
                                          <div style="width: 32px; height: 32px; border-radius: 10px; background: rgba(255, 255, 255, 0.6); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.5);"><span class="material-icons-round" style="color: #64748b; font-size: 18px;">payment</span></div>
                                          Stato Pagamenti
                                      </h3>
                                      <a href="#tasks-summary" style="font-size: 0.75rem; font-weight: 700; color: #8b5cf6; text-decoration: none;">VEDI STORICO</a>
                                  </div>
                                  <div id="hp-collab-payments-list" class="custom-scrollbar" style="flex: 1; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; padding-right: 8px;"><div style="padding: 2rem; text-align: center; color: #94a3b8;"><span class="loader small"></span></div></div>
                             </div>
                             <div id="hp-collaborator-invoices-box" class="hp-widget-panel" style="display: flex; flex-direction: column; padding: 1.5rem; background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 28px; box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07);">
                                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
                                      <h3 style="font-size: 1.15rem; font-weight: 600; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 10px; letter-spacing: -0.01em;">
                                          <div style="width: 32px; height: 32px; border-radius: 10px; background: rgba(255, 255, 255, 0.6); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.5);"><span class="material-icons-round" style="color: #64748b; font-size: 18px;">receipt_long</span></div>
                                          Stato Fatture
                                      </h3>
                                      <a href="#tasks-summary" style="font-size: 0.75rem; font-weight: 700; color: #8b5cf6; text-decoration: none;">VEDI PASSIVE</a>
                                  </div>
                                  <div id="hp-collab-invoices-list" class="custom-scrollbar" style="flex: 1; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; padding-right: 8px;"><div style="padding: 2rem; text-align: center; color: #94a3b8;"><span class="loader small"></span></div></div>
                             </div>
                         </div>
                     </div>
                     <!-- COLUMN 3 FOR COLLAB (Right side feed) -->
                     <div style="flex: 1; min-width: 260px; display: flex; flex-direction: column; gap: 2rem;">
                          <div id="hp-activity-feed-block" class="hp-widget-panel" style="flex: 1; display: flex; flex-direction: column; max-height: 480px; background: rgba(255, 255, 255, 0.2) !important; backdrop-filter: blur(20px) saturate(180%); -webkit-backdrop-filter: blur(20px) saturate(180%); border: 1px solid rgba(255, 255, 255, 0.3) !important; border-radius: 28px; padding: 1.5rem; box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07);">
                             <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
                                  <h3 style="font-size: 1.15rem; font-weight: 600; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 10px; letter-spacing: -0.02em;">
                                      <div style="width: 32px; height: 32px; border-radius: 10px; background: rgba(255, 255, 255, 0.4); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.5);"><span class="material-icons-round" style="color: #64748b; font-size: 18px;">rss_feed</span></div>Feed
                                  </h3>
                                  <div id="hp-feed-tabs-container" style="display: flex; gap: 4px; background: rgba(0,0,0,0.03); padding: 4px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.02);"></div>
                             </div>
                             <div id="hp-feed-content" class="custom-scrollbar" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding-right: 8px;"></div>
                          </div>
                     </div>
                     ` : `
                      <!-- ==================== PARTNER / ADMIN ==================== -->
                      <!-- 3 COLUMNS FLEX GRID -->
                      <div class="hp-dash-partner-main" style="padding-bottom: 3rem;">
                          
                          <!-- Col 1: Commesse -->
                          <div id="hp-pm-spaces-main-block" style="display: flex; flex-direction: column;">
                             <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 1.25rem;">
                                  <div style="display: flex; justify-content: space-between; align-items: center; padding-left: 8px;">
                                      <h3 style="font-size: 1.15rem; font-weight: 600; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 10px; letter-spacing: -0.01em;">
                                          <div style="width: 32px; height: 32px; border-radius: 10px; background: rgba(255, 255, 255, 0.6); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.5);"><span class="material-icons-round" style="color: #64748b; font-size: 18px;">dashboard</span></div>
                                          Le mie Commesse
                                      </h3>
                                      <div style="display: flex; gap: 6px; background: rgba(0,0,0,0.03); padding: 4px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.02); margin-right: 8px;">
                                        <button id="hp-filter-account" class="hp-filter-pill active" onclick="togglePmFilter('account')" style="padding: 4px 10px; border-radius: 7px; border: none; font-size: 0.65rem; font-weight: 700; cursor: pointer; transition: all 0.2s; background: transparent; color: #64748b;">ACCOUNT</button>
                                        <button id="hp-filter-pm" class="hp-filter-pill active" onclick="togglePmFilter('pm')" style="padding: 4px 10px; border-radius: 7px; border: none; font-size: 0.65rem; font-weight: 700; cursor: pointer; transition: all 0.2s; background: transparent; color: #64748b;">PM</button>
                                      </div>
                                  </div>
                             </div>
                             <div id="hp-projects-stats-bar" style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0.5rem; margin-bottom: 1.5rem;"></div>
                             <div id="hp-pm-spaces-main-list" class="custom-scrollbar" style="flex: 1; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; overflow-x: hidden; padding: 4px 8px 60px 8px;"></div>
                          </div>

                          <!-- Col 2: Attività Interne -->
                          <div id="hp-internal-dashboard-block" style="display: flex; flex-direction: column;">
                              <div style="margin-bottom: 2rem; margin-top: 0.5rem; display: flex; align-items: center; gap: 10px; padding-left: 8px;">
                                  <div style="width: 32px; height: 32px; border-radius: 10px; background: rgba(255, 255, 255, 0.6); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.5);"><span class="material-icons-round" style="color: #64748b; font-size: 18px;">business_center</span></div>
                                  <h3 style="font-size: 1.15rem; font-weight: 600; color: #1e293b; margin: 0; letter-spacing: -0.01em;">Attività interne</h3>
                              </div>
                              <div style="margin-bottom: 2rem;">
                                  <div id="hp-internal-hubs-buttons" style="display: flex; gap: 12px; overflow-x: auto; padding-bottom: 12px; scrollbar-width: none; -ms-overflow-style: none;"></div>
                              </div>
                              <div id="hp-internal-clusters-grid" class="custom-scrollbar" style="flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; overflow-y: auto; padding-bottom: 2rem;"></div>
                          </div>

                          <!-- Col 3: FEED & ALERTS -->
                          <div style="display: flex; flex-direction: column; gap: 2rem;">
                              <!-- ALERT BLOCK -->
                              <div id="hp-accounting-alerts-block" class="hp-widget-panel" style="display: none; flex-direction: column; height: auto; background: rgba(255, 255, 255, 0.2) !important; backdrop-filter: blur(20px) saturate(180%); -webkit-backdrop-filter: blur(20px) saturate(180%); border: 1px solid rgba(255, 255, 255, 0.3) !important; border-radius: 28px; padding: 1.5rem; box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07);">
                                  <div class="flex-start" style="gap: 12px; align-items: center; margin-bottom: 1rem;">
                                      <div style="width: 36px; height: 36px; border-radius: 12px; background: rgba(255, 255, 255, 0.4); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.5);"><span class="material-icons-round" style="color: #64748b; font-size: 20px;">notifications_active</span></div>
                                      <h4 style="font-size: 1.05rem; font-weight: 600; color: #1e293b; margin: 0; letter-spacing: -0.02em;">Alert Amministrazione</h4>
                                  </div>
                                  <div id="hp-admin-alert-list" style="display: flex; flex-direction: column; gap: 4px;"></div>
                              </div>

                              <!-- FEED BLOCK -->
                              <div id="hp-activity-feed-block" class="hp-widget-panel" style="flex: 1; display: flex; flex-direction: column; max-height: 520px; background: rgba(255, 255, 255, 0.2) !important; backdrop-filter: blur(20px) saturate(180%); -webkit-backdrop-filter: blur(20px) saturate(180%); border: 1px solid rgba(255, 255, 255, 0.3) !important; border-radius: 28px; padding: 1.5rem; box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07);">
                                 <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
                                      <h3 style="font-size: 1.15rem; font-weight: 600; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 10px; letter-spacing: -0.02em;">
                                          <div style="width: 32px; height: 32px; border-radius: 10px; background: rgba(255, 255, 255, 0.4); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.5);"><span class="material-icons-round" style="color: #64748b; font-size: 18px;">rss_feed</span></div>Feed
                                      </h3>
                                      <div id="hp-feed-tabs-container" style="display: flex; gap: 4px; background: rgba(0,0,0,0.03); padding: 4px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.02);"></div>
                                 </div>
                                 <div id="hp-feed-content" class="custom-scrollbar" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding-right: 8px;"></div>
                              </div>
                          </div>
                      </div>
                      `}
                 </div> <!-- End hp-main-columns-container -->
            </div> <!-- End main-content-area -->

             """

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content[:start_idx] + new_content + content[end_idx:])
