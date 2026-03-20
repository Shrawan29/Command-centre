import { useState } from 'react';
import Button from '../components/Button.jsx';
import Field from '../components/Field.jsx';
import { loginWithPassword } from '../services/auth.js';

export default function LoginPage({ onLogin }) {
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await loginWithPassword({ email, password });
      const user = res?.user;
      onLogin({
        userId: user._id,
        role: user.role,
        name: user.name,
        email: user.email,
      });
    } catch (e2) {
      setError(e2.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-xl bg-white ring-1 ring-slate-200 p-6">
        <div className="text-lg font-semibold text-slate-900">Login</div>
        <div className="mt-1 text-sm text-slate-600">
          Sign in with your email and password.
        </div>

        {error ? (
          <div className="mt-4 rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm ring-1 ring-red-200">
            {error}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="mt-6 rounded-lg bg-slate-50/70 ring-1 ring-slate-200 p-4">
          <div className="grid grid-cols-1 gap-3">
            <Field label="Email">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                type="email"
                autoComplete="email"
                required
              />
            </Field>

            <Field label="Password">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>

            <div>
              <Button type="submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Login'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
