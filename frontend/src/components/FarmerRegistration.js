import React, { useState } from 'react';
import { getFarmer, registerFarmer } from '../api/api';
import { apiError, cleanPhone, LANGUAGES } from '../utils/helpers';
import { useToast } from '../context/Toast';
import Icon from './ui/Icon';

const STATES = [
  'Andhra Pradesh', 'Telangana', 'Tamil Nadu', 'Karnataka', 'Kerala', 'Odisha', 'West Bengal',
  'Chhattisgarh', 'Punjab', 'Haryana', 'Uttar Pradesh', 'Bihar', 'Assam', 'Maharashtra',
];

const SOILS = [
  { value: 'clay', title: 'Clay', hint: 'Heavy soil that holds water' },
  { value: 'loamy', title: 'Loamy', hint: 'Medium soil, the standard case' },
  { value: 'sandy', title: 'Sandy', hint: 'Light soil that drains fast' },
];

const EMPTY = {
  name: '',
  phone: '',
  email: '',
  preferredLanguage: 'te-IN',
  state: 'Andhra Pradesh',
  district: '',
  plantingDate: '',
  soilType: 'loamy',
};

export default function FarmerRegistration({ onAuthed }) {
  const { notify } = useToast();
  const [mode, setMode] = useState('register');
  const [form, setForm] = useState(EMPTY);
  const [signInPhone, setSignInPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const switchMode = (m) => {
    setMode(m);
    setError('');
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    const phone = cleanPhone(signInPhone);
    if (phone.replace(/\D/g, '').length < 10) return setError('Enter the 10-digit phone number you registered with.');
    setBusy(true);
    setError('');
    try {
      const res = await getFarmer(phone);
      notify(`Welcome back, ${res.data.name.split(' ')[0]}.`, 'success');
      onAuthed(res.data);
    } catch (err) {
      setError(
        err.response && err.response.status === 404
          ? 'No account found for this number. Register your crop to get started.'
          : apiError(err, 'Could not reach the server. Check that the backend is running.')
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const phone = cleanPhone(form.phone);
    if (phone.replace(/\D/g, '').length < 10) return setError('Phone number must have at least 10 digits.');
    setBusy(true);
    setError('');
    try {
      const res = await registerFarmer({ ...form, phone });
      notify(
        res.data.created
          ? `Crop registered. ${res.data.taskCount} tasks added to your calendar.`
          : 'This number is already registered. Signed you in.',
        'success'
      );
      onAuthed(res.data.farmer);
    } catch (err) {
      setError(apiError(err, 'Could not reach the server. Check that the backend is running.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <aside className="auth-hero">
        <div className="brand brand-light">
          <span className="brand-mark"><Icon name="sprout" size={22} /></span>
          <span className="brand-name">FarmMitra AI</span>
        </div>
        <div className="auth-hero-body">
          <h1>Ask in your own language. Plan every week of the paddy season.</h1>
          <p>
            Speak or type a question and get advice built on today's mandi prices and the local forecast. Check a
            leaf for disease. Follow a task calendar that adjusts to your soil.
          </p>
        </div>
        <ul className="auth-points">
          <li><Icon name="mic" size={18} /> Voice questions in Telugu, Hindi and English</li>
          <li><Icon name="leaf" size={18} /> Leaf photo to disease and remedy</li>
          <li><Icon name="calendar" size={18} /> Soil-adjusted crop calendar with reminders</li>
        </ul>
        <svg className="auth-field" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, i) => (
            <path key={i} d={`M0 ${30 + i * 10} Q 100 ${10 + i * 10} 200 ${30 + i * 10} T 400 ${30 + i * 10}`} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="1.5" />
          ))}
        </svg>
      </aside>

      <main className="auth-panel">
        <div className="auth-card">
          <div className="segmented" role="tablist" aria-label="Account">
            <button role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'on' : ''} onClick={() => switchMode('register')} type="button">
              Register crop
            </button>
            <button role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'on' : ''} onClick={() => switchMode('signin')} type="button">
              Sign in
            </button>
          </div>

          {mode === 'signin' ? (
            <form onSubmit={handleSignIn} className="form" noValidate>
              <h2>Welcome back</h2>
              <p className="muted">Enter the phone number you registered with.</p>
              <div className="field">
                <label htmlFor="si-phone">Phone number</label>
                <input id="si-phone" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={signInPhone} onChange={(e) => setSignInPhone(e.target.value)} required />
              </div>
              {error && <p className="form-error" role="alert"><Icon name="alert" size={16} /> {error}</p>}
              <button className="btn btn-primary btn-block" disabled={busy} type="submit">{busy ? 'Signing in...' : 'Sign in'}</button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="form" noValidate>
              <h2>Register your paddy crop</h2>
              <p className="muted">We use your planting date and soil to build your task calendar.</p>

              <fieldset>
                <legend>About you</legend>
                <div className="field">
                  <label htmlFor="name">Full name</label>
                  <input id="name" name="name" autoComplete="name" value={form.name} onChange={set} required />
                </div>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="phone">Phone number</label>
                    <input id="phone" name="phone" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={form.phone} onChange={set} required />
                  </div>
                  <div className="field">
                    <label htmlFor="preferredLanguage">Language for voice replies</label>
                    <select id="preferredLanguage" name="preferredLanguage" value={form.preferredLanguage} onChange={set}>
                      {LANGUAGES.map((l) => (<option key={l.code} value={l.code}>{l.native} ({l.label})</option>))}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="email">Email <span className="optional">optional, for task reminders</span></label>
                  <input id="email" name="email" type="email" autoComplete="email" value={form.email} onChange={set} />
                </div>
              </fieldset>

              <fieldset>
                <legend>Your farm</legend>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="state">State</label>
                    <input id="state" name="state" list="state-list" value={form.state} onChange={set} required />
                    <datalist id="state-list">{STATES.map((s) => <option key={s} value={s} />)}</datalist>
                  </div>
                  <div className="field">
                    <label htmlFor="district">District</label>
                    <input id="district" name="district" placeholder="e.g. Krishna" value={form.district} onChange={set} required />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="plantingDate">Planting date <span className="optional">day you sow the nursery</span></label>
                  <input id="plantingDate" name="plantingDate" type="date" value={form.plantingDate} onChange={set} required />
                </div>
                <div className="field">
                  <span className="label">Soil type</span>
                  <div className="soil-grid" role="radiogroup" aria-label="Soil type">
                    {SOILS.map((s) => (
                      <label key={s.value} className={`soil ${form.soilType === s.value ? 'on' : ''}`}>
                        <input type="radio" name="soilType" value={s.value} checked={form.soilType === s.value} onChange={set} />
                        <strong>{s.title}</strong>
                        <span>{s.hint}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </fieldset>

              {error && <p className="form-error" role="alert"><Icon name="alert" size={16} /> {error}</p>}
              <button className="btn btn-primary btn-block" disabled={busy} type="submit">
                {busy ? 'Building your calendar...' : 'Register and build my calendar'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}