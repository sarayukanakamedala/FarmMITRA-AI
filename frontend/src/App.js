import React, { useCallback, useEffect, useState } from 'react';
import { getFarmer } from './api/api';
import { ToastProvider } from './context/Toast';
import FarmerRegistration from './components/FarmerRegistration';
import Dashboard from './components/Dashboard';
import MarketInsights from './components/MarketInsights';
import ChatWindow from './components/ChatWindow';
import DiseaseUpload from './components/DiseaseUpload';
import TodoDashboard from './components/TodoDashboard';
import Icon from './components/ui/Icon';
import { LANGUAGES } from './utils/helpers';

const SESSION_KEY = 'farmmitra.phone';

const NAV = [
  { id: 'home', label: 'Overview', icon: 'home' },
  { id: 'ask', label: 'Ask', icon: 'mic' },
  { id: 'market', label: 'Market', icon: 'chart' },
  { id: 'disease', label: 'Leaf check', icon: 'leaf' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
];

const TITLES = {
  home: 'Overview',
  ask: 'Ask a question',
  market: 'Market and weather',
  disease: 'Leaf disease check',
  calendar: 'Crop calendar',
};

function Shell({ farmer, onSignOut }) {
  const [view, setView] = useState('home');
  const [language, setLanguage] = useState(farmer.preferredLanguage || 'te-IN');
  const [messages, setMessages] = useState([]);
  const [prefill, setPrefill] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const bump = useCallback(() => setRefreshKey((k) => k + 1), []);

  const askAbout = (text) => {
    setPrefill({ text, nonce: Date.now() });
    setView('ask');
  };

  const go = (id) => {
    setView(id);
    window.scrollTo({ top: 0 });
  };

  const lang = LANGUAGES.find((l) => l.code === language);

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <span className="brand-mark"><Icon name="sprout" size={22} /></span>
          <span className="brand-name">FarmMitra AI</span>
        </div>
        <nav aria-label="Main">
          {NAV.map((n) => (
            <button key={n.id} type="button" className={`nav-item ${view === n.id ? 'on' : ''}`} onClick={() => go(n.id)} aria-current={view === n.id ? 'page' : undefined}>
              <Icon name={n.icon} size={20} />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="rail-foot">
          <div className="farmer-chip">
            <span className="avatar">{farmer.name.trim().charAt(0).toUpperCase()}</span>
            <div>
              <strong>{farmer.name}</strong>
              <span>{farmer.phone}</span>
            </div>
          </div>
          <button type="button" className="nav-item subtle" onClick={onSignOut}><Icon name="logout" size={19} /><span>Sign out</span></button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="brand brand-compact">
            <span className="brand-mark"><Icon name="sprout" size={20} /></span>
          </div>
          <h1>{TITLES[view]}</h1>
          <div className="topbar-right">
            <span className="lang-badge" title="Reply language">{lang ? lang.native : language}</span>
            <button type="button" className="btn btn-ghost btn-icon mobile-only" onClick={onSignOut} aria-label="Sign out"><Icon name="logout" size={19} /></button>
          </div>
        </header>

        <main className="content">
          {view === 'home' && <Dashboard farmer={farmer} onNavigate={go} refreshKey={refreshKey} onChanged={bump} />}
          {view === 'market' && <MarketInsights farmer={farmer} onAsk={askAbout} />}
          {view === 'calendar' && <TodoDashboard farmer={farmer} refreshKey={refreshKey} onChanged={bump} />}
          <div className={view === 'ask' ? '' : 'view-hidden'}>
            <ChatWindow farmer={farmer} language={language} onLanguageChange={setLanguage} prefill={prefill} messages={messages} setMessages={setMessages} />
          </div>
          <div className={view === 'disease' ? '' : 'view-hidden'}>
            <DiseaseUpload farmer={farmer} language={language} />
          </div>
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Main">
        {NAV.map((n) => (
          <button key={n.id} type="button" className={view === n.id ? 'on' : ''} onClick={() => go(n.id)} aria-current={view === n.id ? 'page' : undefined}>
            <Icon name={n.icon} size={22} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  const [farmer, setFarmer] = useState(null);
  const [restoring, setRestoring] = useState(() => !!localStorage.getItem(SESSION_KEY));

  useEffect(() => {
    const phone = localStorage.getItem(SESSION_KEY);
    if (!phone) return;
    getFarmer(phone)
      .then((res) => setFarmer(res.data))
      .catch(() => {})
      .finally(() => setRestoring(false));
  }, []);

  const handleAuthed = (f) => {
    localStorage.setItem(SESSION_KEY, f.phone);
    setFarmer(f);
  };

  const signOut = () => {
    localStorage.removeItem(SESSION_KEY);
    setFarmer(null);
  };

  return (
    <ToastProvider>
      {restoring ? (
        <div className="splash"><span className="brand-mark"><Icon name="sprout" size={26} /></span><p>Loading your farm...</p></div>
      ) : farmer ? (
        <Shell farmer={farmer} onSignOut={signOut} />
      ) : (
        <FarmerRegistration onAuthed={handleAuthed} />
      )}
    </ToastProvider>
  );
}