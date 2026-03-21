import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "./ui/drawer";

// TODO: Reuse this for Roles/Projects/AuditLogs "View" drawers.
// Renders a reusable right-side details drawer.
export function DetailsSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const { open, onOpenChange, title, description, children } = props;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="inset-y-0 right-0 h-full w-full border-l border-slate-200 sm:max-w-md">
        <DrawerClose
          className="absolute right-2 top-2 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          aria-label="Close"
        >
          <span className="text-lg leading-none">×</span>
        </DrawerClose>

        <div className="flex h-full flex-col px-6 pb-6 pt-4">
          <DrawerHeader className="pr-10">
            <DrawerTitle>{title}</DrawerTitle>
            {description ? (
              <DrawerDescription>{description}</DrawerDescription>
            ) : null}
          </DrawerHeader>
          <div className="mt-4 space-y-4">{children}</div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
