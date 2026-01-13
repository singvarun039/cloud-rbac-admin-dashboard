import type { ReactNode } from "react";
import { useEffect } from "react";

export default function Modal(props: {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const { title, isOpen, onClose, children } = props;

  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal" role="document">
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="btn" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
