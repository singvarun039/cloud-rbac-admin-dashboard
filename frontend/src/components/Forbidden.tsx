type ForbiddenProps = {
  pageTitle?: string;
  title?: string;
  description?: string;
};

export default function Forbidden(props: ForbiddenProps) {
  const pageTitle = props.pageTitle ?? "Forbidden";
  const title = props.title ?? "Forbidden (403)";
  const description =
    props.description ?? "You don’t have permission to view this page.";

  return (
    <div className="page">
      <h1 className="page-title">{pageTitle}</h1>
      <div className="card">
        <div className="card-title">{title}</div>
        <div className="muted">{description}</div>
      </div>
    </div>
  );
}
