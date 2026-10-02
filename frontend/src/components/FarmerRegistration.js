import React, { useState } from 'react';
import { registerFarmer } from '../api/api';

export default function FarmerRegistration({ onRegistered }) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    preferredLanguage: 'te-IN',
    state: '',
    district: '',
    plantingDate: '',
    soilType: 'loamy',
  });
  const [status, setStatus] = useState(null);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('saving');
    try {
      const res = await registerFarmer(form);
      setStatus('success');
      onRegistered && onRegistered(form.phone, res.data);
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  return (
    <div className="card">
      <h2>Register Your Paddy Crop</h2>
      <p>Tell us about your planting so we can build your personalized task calendar.</p>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Name</label>
          <input name="name" value={form.name} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>Phone (WhatsApp)</label>
          <input name="phone" value={form.phone} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>Email (optional, for reminders)</label>
          <input name="email" type="email" value={form.email} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Preferred Language</label>
          <select name="preferredLanguage" value={form.preferredLanguage} onChange={handleChange}>
            <option value="te-IN">Telugu</option>
            <option value="hi-IN">Hindi</option>
            <option value="en-IN">English</option>
          </select>
        </div>
        <div className="form-group">
          <label>State</label>
          <input name="state" value={form.state} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>District</label>
          <input name="district" value={form.district} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>Planting Date</label>
          <input name="plantingDate" type="date" value={form.plantingDate} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>Soil Type</label>
          <select name="soilType" value={form.soilType} onChange={handleChange}>
            <option value="clay">Clay / Heavy soil (retains water)</option>
            <option value="loamy">Loamy / Medium soil</option>
            <option value="sandy">Sandy / Light soil (drains fast)</option>
          </select>
        </div>
        <button className="btn-primary" type="submit" disabled={status === 'saving'}>
          {status === 'saving' ? 'Saving...' : 'Register & Generate My Task Calendar'}
        </button>
        {status === 'success' && <p style={{ color: 'green' }}>Registered! Check the To-Do tab.</p>}
        {status === 'error' && <p style={{ color: 'red' }}>Something went wrong. Please try again.</p>}
      </form>
    </div>
  );
}
