import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '../../src/pages/Login';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  login: vi.fn(),
  toastSuccess: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useLocation: () => ({ state: { from: '/dashboard' } }),
  };
});

vi.mock('../../src/auth/useAuth', () => ({
  useAuth: () => mocks.useAuth(),
}));

vi.mock('../../src/components/ui/use-toast', () => ({
  toast: {
    success: mocks.toastSuccess,
  },
}));

describe('LoginPage', () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.login.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.useAuth.mockReturnValue({
      login: mocks.login,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it('shows validation feedback when fields are missing', async () => {
    render(<LoginPage />);

    fireEvent.submit(screen.getByRole('button', { name: 'Login' }).closest('form')!);

    expect(await screen.findByText('Email and password are required.')).toBeTruthy();
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('submits credentials, shows toast, and redirects on success', async () => {
    mocks.login.mockResolvedValue({ ok: true });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'demo@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(mocks.login).toHaveBeenCalledWith('demo@example.com', 'secret123');
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Signed in');
    expect(mocks.navigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('renders a server-side login error when authentication fails', async () => {
    mocks.login.mockResolvedValue({ ok: false, error: 'Invalid credentials' });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'demo@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    expect(await screen.findByText('Invalid credentials')).toBeTruthy();
  });
});
