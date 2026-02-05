import { Outlet } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import Forbidden from "./Forbidden";

export default function RequirePermissionRoute(props: {
  permission: string;
  pageTitle: string;
  description: string;
}) {
  const { permissions, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
        <div className="muted">Loading…</div>
      </div>
    );
  }

  if (!permissions.includes(props.permission)) {
    return (
      <Forbidden pageTitle={props.pageTitle} description={props.description} />
    );
  }

  return <Outlet />;
}
