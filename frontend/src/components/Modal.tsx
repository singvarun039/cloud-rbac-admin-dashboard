import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

export default function Modal(props: {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const { title, isOpen, onClose, children } = props;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
