import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPostJson } from '../lib/api.js';
import { setAuth } from '../lib/auth.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-sky-600 text-white font-extrabold flex items-center justify-center">
                M
              </div>
              <div>
                <div className="text-lg font-bold text-slate-900 leading-tight">Mapping Jaringan</div>
                <div className="text-xs text-slate-500">Login untuk masuk ke dashboard</div>
              </div>
            </div>
          </div>

          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setLoading(true);
                setError('');
                const result = await apiPostJson('/api/auth/login', { email, password });
                setAuth(result.token, result.user);
                navigate('/', { replace: true });
              } catch (err) {
                setError(err.message || 'Login gagal');
              } finally {
                setLoading(false);
              }
            }}
          >
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-100"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                placeholder="nama@domain.com"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-100"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>

            {error ? (
              <div className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-red-700 ring-1 ring-red-200">
                {error}
              </div>
            ) : null}

            <button
              className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Masuk…' : 'Masuk'}
            </button>
          </form>
        </div>

        <div className="mt-4 text-center text-xs text-slate-500">Pastikan koneksi ke server aktif.</div>
      </div>
    </div>
  );
}
