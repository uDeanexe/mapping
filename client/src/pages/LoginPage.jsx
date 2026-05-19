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
    <div className="login-page">
      <div className="login-card">
        <div className="login-card-aside">
          <div>
            <div className="brand-title">Mapping Jaringan</div>
            <p className="login-copy">Akses cepat untuk NOC dan teknisi lapangan dengan pengalaman yang nyaman di desktop dan perangkat mobile.</p>
          </div>
          <div className="login-features">
            <div className="feature-item">📍 Pantau node, link, dan gangguan secara real-time</div>
            <div className="feature-item">📱 Desain responsif untuk mobile dan desktop</div>
            <div className="feature-item">🔐 Sistem login aman dengan token otentikasi</div>
          </div>
        </div>

        <form
          className="login-card-content"
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
          <div className="login-heading">
            <h1>Masuk ke Sistem</h1>
            <p className="muted">Gunakan akun Anda untuk mengelola mapping jaringan, gangguan, dan laporan kerja.</p>
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
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
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          {error ? <div className="alert-error">{error}</div> : null}

          <button className="button button-primary" type="submit" disabled={loading}>
            {loading ? 'Masuk...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  );
}

