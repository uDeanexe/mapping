import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPostJson } from '../lib/api.js';
import { setAuth } from '../lib/auth.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('superadmin@mapping.local');
  const [password, setPassword] = useState('superadmin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-6 rounded-[28px] bg-white shadow-[0_30px_70px_rgba(15,23,42,0.12)] lg:grid-cols-[1.05fr_1.3fr]">
        <div className="rounded-[28px] bg-gradient-to-b from-sky-600 via-sky-700 to-indigo-900 p-10 text-white lg:p-12">
          <div className="space-y-6">
            <div>
              <div className="text-3xl font-extrabold">Mapping Jaringan</div>
              <p className="mt-4 max-w-[28rem] text-base leading-7 text-slate-200">
                Akses cepat untuk NOC dan teknisi lapangan dengan pengalaman yang nyaman di desktop dan perangkat mobile.
              </p>
            </div>
            <div className="grid gap-4">
              <div className="rounded-3xl bg-white/10 p-4 text-sm leading-6 shadow-lg shadow-slate-950/10">
                📍 Pantau node, link, dan gangguan secara real-time
              </div>
              <div className="rounded-3xl bg-white/10 p-4 text-sm leading-6 shadow-lg shadow-slate-950/10">
                📱 Desain responsif untuk mobile dan desktop
              </div>
              <div className="rounded-3xl bg-white/10 p-4 text-sm leading-6 shadow-lg shadow-slate-950/10">
                🔐 Sistem login aman dengan token otentikasi
              </div>
            </div>
          </div>
        </div>
        <form
          className="flex flex-col justify-center gap-6 px-6 py-10 sm:px-10 lg:px-12"
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
          <div className="space-y-2">
            <h1>Masuk ke Sistem</h1>
            <p className="muted">Gunakan akun Anda untuk mengelola mapping jaringan, gangguan, dan laporan kerja.</p>
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-100"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="superadmin@mapping.local"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-100"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          {error ? <div className="rounded-3xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-200">{error}</div> : null}

          <button className="inline-flex w-full items-center justify-center rounded-3xl bg-sky-600 px-5 py-3 text-base font-semibold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70" type="submit" disabled={loading}>
            {loading ? 'Masuk...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  );
}

