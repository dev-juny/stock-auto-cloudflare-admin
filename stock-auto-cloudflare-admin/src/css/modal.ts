export const modalCss = `
.modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.modal-overlay.active {
  display: flex;
}
.modal-box {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 1.5rem 2rem;
  max-width: 400px;
  width: 90%;
  text-align: center;
}
.modal-box p {
  margin-bottom: 1.5rem;
  font-size: 14px;
  line-height: 1.6;
  color: #c9d1d9;
}
.modal-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}
.modal-actions button {
  width: auto;
  min-width: 80px;
  padding: 8px 20px;
  margin: 0;
  font-size: 13px;
}
.modal-confirm { background: #da3633 !important }
.modal-confirm:hover { background: #f85149 !important }
.modal-cancel { background: #30363d !important }
.modal-cancel:hover { background: #484f58 !important }
`;
