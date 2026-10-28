
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const successMessage = (
    location.state as { message?: string } | null
  )?.message;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const normalizedEmail = email.trim();
    
    if (!normalizedEmail || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/login', {
        email: normalizedEmail,
        password,
      });

      const { accessToken, user } = response.data;

      if (typeof accessToken !== 'string' || !accessToken) {
        setError('The server did not return an access token.');
        return;
      }

      // Temporary in-memory token storage.
      // We'll move this into shared authentication context next.
      window.dispatchEvent(
        new CustomEvent('splitmate:login', {
          detail: { accessToken, user },
        }),
      );

      navigate('/', { replace: true });
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'response' in err) {
        const response = (
          err as { response?: { status?: number; data?: { message?: string | string[] } } }
        ).response;

        const message = response?.data?.message;

        if (response?.status === 401) {
          setError('Incorrect email or password.');
        } else {
          setError(
            Array.isArray(message)
              ? message.join(' ')
              : message || 'Login failed. Please try again.',
          );
        }
      } else {
        setError('Could not connect to the server. Check that the backend is running.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link to="/" className="auth-brand">
          <span className="brand-icon">S</span>
          SplitMate
        </Link>

        <h1>Welcome back</h1>
        <p className="auth-description">
          Sign in to manage your shared expenses.
        </p>

        {successMessage && (
          <p className="auth-success" role="status">
            {successMessage}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={loading}
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loading}
          />

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account? <Link to="/register">Create one</Link>
        </p>

        <Link to="/" className="auth-back">
          ← Back to home
        </Link>
      </section>
    </main>
  );
}

export default LoginPage;
