import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

type ForbiddenProps = {
  pageTitle?: string;
  title?: string;
  description?: string;
};

// Renders a reusable forbidden-state panel.
export default function Forbidden(props: ForbiddenProps) {
  const pageTitle = props.pageTitle ?? "Forbidden";
  const title = props.title ?? "Forbidden (403)";
  const description =
    props.description ?? "You don’t have permission to view this page.";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{pageTitle}</h1>
      </div>

      <Alert variant="destructive">
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{description}</AlertDescription>
      </Alert>
    </div>
  );
}
