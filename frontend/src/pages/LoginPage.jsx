import React, { useState, useEffect } from 'react';
import { setPortal } from '../utils/initials';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, GraduationCap, Eye, EyeOff, Shield } from 'lucide-react';
import './LoginPage.css';

const LoginPage = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // The page previews the ink of the portal you are about to enter.
  useEffect(() => { setPortal(role); }, [role]);

  const MOCK_CREDENTIALS = {
    student: [
      { label: 'Alex Johnson', email: 'student@edu.com', password: 'student123' },
    ],
    teacher: [
      { label: 'Dr. Robert Chen', email: 'teacher@edu.com', password: 'teacher123' },
      { label: 'Dr. Alan Physics', email: 'physics_teacher@edu.com', password: 'teacher123' },
      { label: 'Dr. Marie Chem', email: 'chemistry_teacher@edu.com', password: 'teacher123' },
      { label: 'Dr. Euler Maths', email: 'maths_teacher@edu.com', password: 'teacher123' },
      { label: 'Dr. Jane Zoology', email: 'zoology_teacher@edu.com', password: 'teacher123' },
      { label: 'Dr. Gregor Botany', email: 'botany_teacher@edu.com', password: 'teacher123' },
    ],
    admin: [
      { label: 'Super Admin', email: 'admin@edu.com', password: 'admin123' },
    ],
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Use the apiClient to hit our NestJS backend
      const { apiClient } = await import('../api/client');
      const data = await apiClient.post('/auth/login', { email, password });
      
      // Store tokens and user details. The refresh token lets apiClient renew a
      // expired session silently instead of bouncing the user back to login.
      localStorage.setItem('access_token', data.accessToken);
      if (data.refreshToken) localStorage.setItem('refresh_token', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Navigate based on actual role from database
      // Force full reload so AppDataContext fetches initial data
      if (data.user.role === 'admin') {
        window.location.assign('/admin');
      } else if (data.user.role === 'teacher') {
        window.location.assign('/teacher');
      } else {
        window.location.assign('/student');
      }
    } catch (err) {
      setError(err.message || 'That email and password do not match an account');
    } finally {
      setLoading(false);
    }
  };

  // A strip of the answer sheet students fill in: four questions, one marked
  // bubble each. Static — it is the product's own object, not decoration.
  const SHEET = [
    { q: 1, pick: 1 },
    { q: 2, pick: 3 },
    { q: 3, pick: 0 },
    { q: 4, pick: 2 },
  ];

  return (
    <div className="login-page">
      {/* Left panel: what this is, and the answer sheet it revolves around */}
      <div className="login-branding">
        <div className="brand-content">
          <div className="brand-logo">
            <span className="brand-mark" aria-hidden="true" />
            <span>EduCommand</span>
          </div>
          <h1>Question papers, mock tests and results for JEE and NEET batches</h1>
          <p>Teachers build papers from the question bank, students sit them in a proctored exam hall, and everyone sees where the marks were lost.</p>

          <div className="omr-sheet" aria-hidden="true">
            <div className="omr-sheet-head">
              <span>Physics · Section A</span>
              <span className="mono">Roll 24117</span>
            </div>
            {SHEET.map(row => (
              <div className="omr-row" key={row.q}>
                <span className="omr-q mono">{String(row.q).padStart(2, '0')}</span>
                {['A', 'B', 'C', 'D'].map((opt, i) => (
                  <span key={opt} className={`omr-option ${i === row.pick ? 'filled' : ''}`}>{opt}</span>
                ))}
              </div>
            ))}
            <div className="omr-score">12<small>/16</small></div>
          </div>

          <ul className="feature-list">
            <li>Predicted scores and risk flags by topic</li>
            <li>Live doubt chat with teachers</li>
            <li>Spaced-repetition practice from past mistakes</li>
            <li>Batch leaderboards and ranks</li>
          </ul>
        </div>
      </div>

      {/* Right panel: sign in */}
      <div className="login-form-panel">
        <div className="login-form-card">
          <h2>Sign in</h2>
          <p className="login-subtitle">Use the account your institute set up for you</p>

          {/* Role selector */}
          <div className="role-selector" role="tablist" aria-label="Sign in as">
            {[
              { id: 'student', label: 'Student', Icon: GraduationCap },
              { id: 'teacher', label: 'Teacher', Icon: BookOpen },
              { id: 'admin', label: 'Admin', Icon: Shield },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={role === id}
                className={`role-btn ${role === id ? 'active' : ''}`}
                onClick={() => setRole(id)}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                placeholder={(MOCK_CREDENTIALS[role] || MOCK_CREDENTIALS.student)[0].email}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <div className="form-label-row">
                <label htmlFor="login-password">Password</label>
                <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>
              </div>
              <div className="password-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && <div className="error-msg" role="alert">{error}</div>}

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? <span className="spinner"></span> : `Sign in as ${role}`}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="demo-creds">
            <p>Demo accounts · {role}</p>
            {(MOCK_CREDENTIALS[role] || []).map((cred, i) => (
              <div key={i} className="demo-cred-row">
                <code>{cred.label} · {cred.email} / {cred.password}</code>
                <button
                  type="button"
                  className="autofill-btn"
                  onClick={() => {
                    setEmail(cred.email);
                    setPassword(cred.password);
                  }}
                >
                  Use
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
