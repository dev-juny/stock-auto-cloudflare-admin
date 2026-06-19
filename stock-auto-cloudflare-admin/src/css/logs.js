export const logsCss = `
#tradeLogs {
  max-height: 300px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #30363d transparent;
}
#tradeLogs::-webkit-scrollbar { width: 6px }
#tradeLogs::-webkit-scrollbar-track { background: transparent }
#tradeLogs::-webkit-scrollbar-thumb {
  background: #30363d;
  border-radius: 3px;
}
#tradeLogs::-webkit-scrollbar-thumb:hover { background: #484f58 }

.log-entry {
  padding: 6px 4px;
  border-bottom: 1px solid #21262d;
  font-family: monospace;
  font-size: 12px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  transition: background .15s;
}
.log-entry:hover { background: #161b22 }
.log-entry .log-body { flex: 1; line-height: 1.5 }

/* custom checkbox */
.log-entry input[type="checkbox"],
.log-check-all input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  margin: 2px 0 0 0;
  flex-shrink: 0;
  border: 1.5px solid #484f58;
  border-radius: 3px;
  background: #0d1117;
  cursor: pointer;
  position: relative;
  transition: border-color .15s, background .15s;
}
.log-entry input[type="checkbox"]:hover,
.log-check-all input[type="checkbox"]:hover { border-color: #58a6ff }
.log-entry input[type="checkbox"]:checked,
.log-check-all input[type="checkbox"]:checked {
  border-color: #238636;
  background: #238636;
}
.log-entry input[type="checkbox"]:checked::after,
.log-check-all input[type="checkbox"]:checked::after {
  content: '';
  position: absolute;
  left: 4px; top: 1px;
  width: 5px; height: 9px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.log-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding: 8px 10px;
  background: #0d1117;
  border: 1px solid #21262d;
  border-radius: 6px;
  font-size: 12px;
}
.log-check-all {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: #8b949e;
  user-select: none;
}
.log-check-all:hover { color: #c9d1d9 }
.log-count { color: #8b949e; font-size: 12px; flex: 1; text-align: right }
.log-del-btn {
  width: auto;
  padding: 5px 14px;
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  background: #da3633;
  border-radius: 4px;
  transition: background .15s;
}
.log-del-btn:hover { background: #f85149 }
.log-del-btn:disabled { opacity: 0.35; cursor: default; background: #da3633 }

.log-entry.log-entry-selected { background: rgba(35,134,54,.08) }

.pos-pnl { color: #3fb950 }
.neg-pnl { color: #f85149 }
`;
