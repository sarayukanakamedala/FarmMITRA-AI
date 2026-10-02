import React, { useState } from 'react';
import FarmerRegistration from './components/FarmerRegistration';
import ChatWindow from './components/ChatWindow';
import DiseaseUpload from './components/DiseaseUpload';
import TodoDashboard from './components/TodoDashboard';

export default function App() {
  const [activeTab, setActiveTab] = useState('register');
  const [farmerPhone, setFarmerPhone] = useState(null);
  const [farmerLocation, setFarmerLocation] = useState({
    state: '',
    district: '',
    language: 'te-IN',
  });

  const handleRegistered = (phone, data) => {
    setFarmerPhone(phone);
    setActiveTab('todo');
  };

  return (
    <div className="app-container">
      <div className="app-header">
        <h1>🌾 FarmMitra AI</h1>
        <p>Your Voice-Based Farming Companion</p>
      </div>

      <div className="tabs">
        <button
          className={`tab-button ${activeTab === 'register' ? 'active' : ''}`}
          onClick={() => setActiveTab('register')}
        >
          Register
        </button>
        <button
          className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          Ask a Question
        </button>
        <button
          className={`tab-button ${activeTab === 'disease' ? 'active' : ''}`}
          onClick={() => setActiveTab('disease')}
        >
          Disease Check
        </button>
        <button
          className={`tab-button ${activeTab === 'todo' ? 'active' : ''}`}
          onClick={() => setActiveTab('todo')}
        >
          My To-Do List
        </button>
      </div>

      {activeTab === 'register' && (
        <FarmerRegistration
          onRegistered={(phone, data) => {
            handleRegistered(phone, data);
            if (data && data.farmer) {
              setFarmerLocation({
                state: data.farmer.state,
                district: data.farmer.district,
                language: data.farmer.preferredLanguage,
              });
            }
          }}
        />
      )}

      {activeTab === 'chat' && <ChatWindow farmerLocation={farmerLocation} />}

      {activeTab === 'disease' && <DiseaseUpload language={farmerLocation.language} />}

      {activeTab === 'todo' && <TodoDashboard phone={farmerPhone} />}
    </div>
  );
}
