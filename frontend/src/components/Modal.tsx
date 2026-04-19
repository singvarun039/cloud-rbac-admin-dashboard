import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

// Renders a reusable modal shell for forms and confirmations.
export default function Modal(props: {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  contentClassName?: string;
}) {
  const { title, isOpen, onClose, children, contentClassName } = props;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className={contentClassName}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
