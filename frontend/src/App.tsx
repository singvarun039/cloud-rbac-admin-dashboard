import AppRouter from './routes/AppRouter';
import { Toaster } from './components/ui/sonner';

// Renders the application router and global toaster.
export default function App() {
  return (
    <>
      <AppRouter />
      <Toaster richColors closeButton />
    </>
  );
}
