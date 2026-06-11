export const dashboardCss = `
header {
  background: #161b22;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #30363d;
}
header h1 { color: #58a6ff; font-size: 18px }

/* hamburger */
.hamburger {
  background: none;
  border: none;
  cursor: pointer;
  width: 32px;
  height: 32px;
  padding: 4px;
  margin: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  border-radius: 4px;
  transition: background .15s;
}
.hamburger:hover { background: #30363d }
.hamburger span {
  display: block;
  width: 100%;
  height: 2px;
  background: #c9d1d9;
  border-radius: 1px;
  transition: transform .2s, opacity .2s;
}

/* sidebar */
.sidebar {
  position: fixed;
  top: 0; left: 0;
  width: 240px;
  height: 100vh;
  background: #161b22;
  border-right: 1px solid #30363d;
  transform: translateX(-100%);
  transition: transform .25s ease;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}
.sidebar.open { transform: translateX(0) }
.sidebar-header {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #30363d;
  font-size: 14px;
  font-weight: 600;
  color: #8b949e;
  letter-spacing: .5px;
}
.sidebar-nav { flex: 1; padding: 8px 0 }
.sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 1.25rem;
  cursor: pointer;
  font-size: 14px;
  color: #c9d1d9;
  transition: background .15s, color .15s;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
}
.sidebar-item:hover { background: #1c2128; color: #58a6ff }
.sidebar-item.active { background: #1c2128; color: #58a6ff; border-left: 3px solid #58a6ff }
.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 999;
  opacity: 0;
  pointer-events: none;
  transition: opacity .25s ease;
}
.sidebar-overlay.show { opacity: 1; pointer-events: auto }

main {
  max-width: 1200px;
  margin: 2rem auto;
  padding: 0 1rem;
  transition: margin-left .25s ease;
}

.page { display: none }
.page.active { display: block }

.card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}
.card h3 { color: #58a6ff; margin-bottom: 1rem; font-size: 16px }
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
}
.stat { background: #0d1117; padding: 0.75rem; border-radius: 6px; text-align: center }
.stat .val { font-size: 20px; font-weight: bold; color: #58a6ff }
.stat .label { font-size: 12px; color: #8b949e; margin-top: 4px }
#loginScreen, #appScreen { transition: opacity .2s }
`;
