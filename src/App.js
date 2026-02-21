import { useState } from 'react';
import Auth from './components/Auth';
import Chat from './components/Chat';
import YouTubeChannelDownload from './components/YouTubeChannelDownload';
import './App.css';

function App() {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('chatapp_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const handleLogin = (userData) => {
    const u = typeof userData === 'string' ? { username: userData, firstName: '', lastName: '' } : userData;
    localStorage.setItem('chatapp_user', JSON.stringify(u));
    setUser(u);
  };

  const handleLogout = () => {
    localStorage.removeItem('chatapp_user');
    setUser(null);
  };

  const [activeTab, setActiveTab] = useState('chat');

  if (user) {
    return (
      <div className="app-tabs">
        <div className="app-tab-bar">
          <button
            className={activeTab === 'chat' ? 'active' : ''}
            onClick={() => setActiveTab('chat')}
          >
            Chat
          </button>
          <button
            className={activeTab === 'youtube' ? 'active' : ''}
            onClick={() => setActiveTab('youtube')}
          >
            YouTube Channel Download
          </button>
        </div>
        {activeTab === 'chat' && <Chat user={user} onLogout={handleLogout} />}
        {activeTab === 'youtube' && <YouTubeChannelDownload />}
      </div>
    );
  }
  return <Auth onLogin={handleLogin} />;
}

export default App;
