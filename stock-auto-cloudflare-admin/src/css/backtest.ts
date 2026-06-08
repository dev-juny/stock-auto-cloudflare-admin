export const backtestCss = `
/* backtest page */
.backtest-params {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 1rem;
}
.backtest-params label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #8b949e;
}
.backtest-params input, .backtest-params select {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 4px;
  padding: 6px 8px;
  color: #c9d1d9;
  font-size: 13px;
  width: 100%;
}
.backtest-params input:focus {
  border-color: #58a6ff;
  outline: none;
}

.backtest-form {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 1rem;
  align-items: end;
}
.backtest-form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #8b949e;
}
.backtest-form input {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 4px;
  padding: 6px 8px;
  color: #c9d1d9;
  font-size: 13px;
  width: 120px;
}
.backtest-form input:focus {
  border-color: #58a6ff;
  outline: none;
}

.btn {
  background: #238636;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: background .15s;
}
.btn:hover { background: #2ea043 }
.btn:disabled { opacity: .5; cursor: default }
.btn-danger { background: #da3633 }
.btn-danger:hover { background: #f85149 }

.price-inputs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.price-inputs .price-tag {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  color: #c9d1d9;
  display: flex;
  align-items: center;
  gap: 6px;
}
.price-inputs .price-tag .remove-price {
  cursor: pointer;
  color: #f85149;
  font-weight: bold;
}
.price-inputs .price-tag .day-num {
  color: #8b949e;
  margin-right: 2px;
}

.backtest-result-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin-top: 1rem;
}
.backtest-result-table th {
  text-align: left;
  padding: 8px;
  border-bottom: 2px solid #30363d;
  color: #8b949e;
  font-weight: 600;
  font-size: 12px;
}
.backtest-result-table td {
  padding: 8px;
  border-bottom: 1px solid #21262d;
}
.backtest-result-table .signal-sell {
  color: #f85149;
  font-weight: 600;
}
.backtest-result-table .signal-buy {
  color: #3fb950;
  font-weight: 600;
}
.backtest-result-table .signal-hold {
  color: #58a6ff;
}
.backtest-result-table .signal-none {
  color: #484f58;
}
.backtest-result-table .profit-positive { color: #3fb950 }
.backtest-result-table .profit-negative { color: #f85149 }

.active-positions-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.active-positions-table th {
  text-align: left;
  padding: 8px;
  border-bottom: 2px solid #30363d;
  color: #8b949e;
  font-weight: 600;
  font-size: 12px;
}
.active-positions-table td {
  padding: 8px;
  border-bottom: 1px solid #21262d;
}
.pos-profit { color: #3fb950 }
.pos-loss { color: #f85149 }

/* scan section */
.scan-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #21262d;
}
.scan-section h4 {
  color: #c9d1d9;
  margin: 0 0 12px;
  font-size: 14px;
}
.scan-ticker-row {
  display: flex;
  gap: 8px;
  align-items: end;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.scan-ticker-row label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #8b949e;
}
.scan-ticker-row input {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 4px;
  padding: 6px 8px;
  color: #c9d1d9;
  font-size: 13px;
  width: 100px;
}
.scan-ticker-row input:focus {
  border-color: #58a6ff;
  outline: none;
}
.scan-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 8px 0;
  font-size: 12px;
  color: #8b949e;
}
.scan-progress-bar {
  flex: 1;
  height: 6px;
  background: #21262d;
  border-radius: 3px;
  overflow: hidden;
}
.scan-progress-fill {
  height: 100%;
  background: #238636;
  border-radius: 3px;
  transition: width .3s;
  width: 0%;
}
.scan-status-text {
  color: #8b949e;
  font-size: 12px;
  margin: 4px 0;
}
.scan-results-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  margin-top: 8px;
}
.scan-results-table th {
  text-align: left;
  padding: 6px 8px;
  border-bottom: 2px solid #30363d;
  color: #8b949e;
  font-weight: 600;
  font-size: 11px;
  white-space: nowrap;
}
.scan-results-table td {
  padding: 6px 8px;
  border-bottom: 1px solid #21262d;
  white-space: nowrap;
}
.scan-results-table tr:hover td {
  background: #161b22;
}
.scan-positive { color: #3fb950 }
.scan-negative { color: #f85149 }

.backtest-date-range input[type="date"] {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 4px;
  padding: 6px 8px;
  color: #c9d1d9;
  font-size: 13px;
  width: 150px;
}

.btn-detail {
  background: #1f6feb;
  border: none;
  border-radius: 4px;
  padding: 4px 10px;
  color: #fff;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}
.btn-detail:hover { background: #388bfd }

.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  font-size: 12px;
  color: #8b949e;
}
.pagination-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.btn-pagination {
  background: #21262d;
  border: 1px solid #30363d;
  border-radius: 4px;
  padding: 4px 10px;
  color: #c9d1d9;
  font-size: 12px;
  cursor: pointer;
}
.btn-pagination:hover { background: #30363d }
.btn-pagination:disabled { opacity: .4; cursor: default }
.pagination-info { font-size: 12px; color: #8b949e; }

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.detail-loading, .detail-error {
  padding: 2rem;
  text-align: center;
  color: #8b949e;
  font-size: 14px;
}
.detail-error { color: #f85149 }

/* stats bar */
.stats-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  padding: 10px 12px;
  margin-bottom: 12px;
  background: #0d1117;
  border: 1px solid #21262d;
  border-radius: 6px;
}
.stat-item {
  display: flex;
  flex-direction: column;
  min-width: 80px;
}
.stat-item .stat-label {
  font-size: 10px;
  color: #8b949e;
}
.stat-item .stat-val {
  font-size: 13px;
  font-weight: 600;
  color: #c9d1d9;
}

/* detail modal */
.detail-modal-box {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  width: 95%;
  max-width: 960px;
  height: 90vh;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  position: relative;
}
.detail-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}
.detail-modal-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.detail-modal-stats {
  flex-shrink: 0;
}
.detail-modal-chart {
  width: 100%;
  height: 100%;
  min-height: 300px;
  border-radius: 6px;
  overflow: hidden;
}
.detail-modal-grid {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.detail-tab-bar {
  display: flex;
  gap: 0;
  border-bottom: 1px solid #30363d;
  flex-shrink: 0;
  margin-top: 0.75rem;
}
.detail-tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: #8b949e;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 13px;
  transition: color 0.15s, border-color 0.15s;
}
.detail-tab:hover { color: #c9d1d9 }
.detail-tab.active {
  color: #58a6ff;
  border-bottom-color: #58a6ff;
}
.detail-tab-content {
  flex: 1;
  min-height: 0;
  position: relative;
}
.detail-tab-pane {
  display: none;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.detail-tab-pane.active {
  display: flex;
  flex-direction: column;
}
.modal-close-btn {
  background: none;
  border: none;
  color: #8b949e;
  font-size: 24px;
  cursor: pointer;
  line-height: 1;
  padding: 0 4px;
}
.modal-close-btn:hover { color: #c9d1d9 }

.result-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin: 1rem 0;
}
.result-summary .stat {
  background: #0d1117;
  padding: 1rem;
  border-radius: 6px;
  text-align: center;
}
.result-summary .stat .val {
  font-size: 20px;
  font-weight: bold;
  color: #58a6ff;
}
.result-summary .stat .label {
  font-size: 11px;
  color: #8b949e;
  margin-top: 4px;
}
.profit-positive { color: #3fb950 !important }
.profit-negative { color: #f85149 !important }

.backtest-chart-container {
  width: 100%;
  height: 420px;
  margin-top: 1rem;
  border-radius: 6px;
  overflow: hidden;
}

/* results tabs (signals / portfolio) */
.results-tab-bar {
  display: flex;
  gap: 0;
  border-bottom: 1px solid #30363d;
  margin: 0.75rem 0;
}
.results-tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: #8b949e;
  padding: 0.4rem 1rem;
  cursor: pointer;
  font-size: 13px;
  transition: color 0.15s, border-color 0.15s;
}
.results-tab:hover { color: #c9d1d9 }
.results-tab.active {
  color: #58a6ff;
  border-bottom-color: #58a6ff;
}
.results-view { display: none }
.results-view.active { display: block }

.portfolio-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.portfolio-table th, .portfolio-table td {
  padding: 6px 8px;
  text-align: center;
  border-bottom: 1px solid #21262d;
  white-space: nowrap;
}
.portfolio-table th {
  color: #8b949e;
  font-weight: 600;
  position: sticky;
  top: 0;
  background: #0d1117;
}
.portfolio-pos { font-size: 12px; margin: 4px 0; padding: 4px 6px; background: #161b22; border-radius: 4px; line-height: 1.6 }
.portfolio-pos .pos-name { color: #8b949e; font-size: 11px }
.portfolio-pos .pos-details { font-size: 11px; color: #8b949e; margin-top: 2px }
.portfolio-pos .pos-val { color: #c9d1d9; font-weight: 600 }
.portfolio-pos .pos-buy { color: #3fb950 }
.portfolio-pos .pos-hold { color: #58a6ff }
.portfolio-pos .pos-sell { color: #f85149 }
.portfolio-pos .pos-trailing { color: #d29922 }
.portfolio-pos .pos-be { color: #bc8cff }
.portfolio-summary {
  display: flex;
  gap: 1rem;
  padding: 0.75rem;
  background: #0d1117;
  border-radius: 6px;
  margin-bottom: 1rem;
  align-items: center;
}
.portfolio-summary .ps-item { font-size: 13px; color: #8b949e }
.portfolio-summary .ps-item strong { color: #c9d1d9 }
`;
