'use client';

import { FormEvent, useState } from 'react';
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Imeshindikana kuingia.');
      router.replace('/dashboard'); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Kuna tatizo. Jaribu tena.'); }
    finally { setBusy(false); }
  }

  return <form className="login-form" onSubmit={submit}>
    <label className="field-label" htmlFor="admin-email">Admin email</label>
    <div className="input-with-icon"><Mail size={18}/><input id="admin-email" name="email" type="email" autoComplete="username" placeholder="owner@yourfarm.com" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254}/></div>
    <div className="password-label-row"><label className="field-label" htmlFor="admin-password">Password</label><span className="password-note">Private admin account</span></div>
    <div className="input-with-icon"><LockKeyhole size={18}/><input id="admin-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={500}/><button type="button" className="icon-button password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <button type="submit" className="btn btn-primary login-submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={18}/> Checking credentials…</> : <>Sign in securely <LockKeyhole size={17}/></>}</button>
    <p className="login-env-hint">Admin credentials are configured privately by the website owner.</p>
  </form>;
}
