import { X } from "lucide-react";
import type { ReactNode } from "react";
export function Modal({ open, title, children, onClose, wide=false }: { open: boolean; title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? "modal-wide" : ""}`}>
        <div className="modal-head"><div><div className="eyebrow">ParkLedger</div><h2>{title}</h2></div><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18}/></button></div>
        {children}
      </div>
    </div>
  );
}