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
.backtest-result-table .signal-hold {
  color: #58a6ff;
}
.backtest-result-table .profit-positive { color: #3fb950 }
.backtest-result-table .profit-negative { color: #f85149 }

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

.backtest-chart-container {
  width: 100%;
  height: 480px;
  margin-top: 1rem;
  border-radius: 6px;
  overflow: hidden;
}

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
`;
