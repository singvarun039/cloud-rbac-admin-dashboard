import { Outlet } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import Forbidden from './Forbidden';
import { Skeleton } from './ui/skeleton';

// Blocks route access unless the current user has the required permission.
export default function RequirePermissionRoute(props: {
  permission: string;
  pageTitle: string;
  description: string;
}) {
  const { permissions, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="w-full max-w-sm space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
    );
  }

  if (!permissions.includes(props.permission)) {
    return <Forbidden pageTitle={props.pageTitle} description={props.description} />;
  }

  return <Outlet />;
}
