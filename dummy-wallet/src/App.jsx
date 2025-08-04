// src/App.jsx
import React, { useState, useEffect } from 'react';

// --- Debug View Component ---
// Monitors the state of IndexedDB in real-time.
function DebugDbView() {
  const [dbState, setDbState] = useState({ E_S: '...', S2: '...' });

  const checkDb = async () => {
    if (!window.indexedDB) {
        setDbState({ E_S: 'IndexedDB not supported', S2: 'IndexedDB not supported' });
        return;
    }
    try {
      const request = window.indexedDB.open('SyncLayerDB');
      request.onsuccess = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('keys')) {
           setDbState({ E_S: 'Not Set', S2: 'Not Set' });
           db.close();
           return;
        }
        const transaction = db.transaction('keys', 'readonly');
        const store = transaction.objectStore('keys');
        const esRequest = store.get('synclayer_E_S');
        const s2Request = store.get('synclayer_S2');

        let e_s_val = 'Not Set';
        let s2_val = 'Not Set';

        esRequest.onsuccess = () => {
          if (esRequest.result) {
            e_s_val = esRequest.result.substring(0, 25) + '...';
          }
          s2Request.onsuccess = () => {
            if (s2Request.result) {
              s2_val = 'Present';
            }
            setDbState({ E_S: e_s_val, S2: s2_val });
          };
        };
        transaction.oncomplete = () => {
            db.close();
        };
      };
      request.onerror = () => setDbState({ E_S: 'DB Error', S2: 'DB Error' });
    } catch (e) {
      setDbState({ E_S: 'Error', S2: 'Error' });
    }
  };

  useEffect(() => {
    const interval = setInterval(checkDb, 2000); // Check every 2 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="debug-view">
      <h4>⚙️ IndexedDB Status</h4>
      <p><strong>E_S (User Secret):</strong> {dbState.E_S}</p>
      <p><strong>S2 (Migration Key):</strong> {dbState.S2}</p>
    </div>
  );
}


// --- Main Wallet Component ---
function App() {
  const [view, setView] = useState('main'); // main, register, login, migrate
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [migrationView, setMigrationView] = useState('initial'); // initial, dest_showPin, src_inputPin, complete
  const [sdkReady, setSdkReady] = useState(false);

  // Effect to check for the SDK after the app mounts
useEffect(() => {
  const timer = setTimeout(async () => {
    if (window.SynclayerSDKWeb && typeof window.SynclayerSDKWeb.init === 'function') {
      try {
        await window.SynclayerSDKWeb.init();
        setSdkReady(true);
        console.log("✅ SyncLayer SDK initialized successfully.");
      } catch (err) {
        setError("SDK failed to initialize.");
        console.error("SDK init error:", err);
      }
    } else {
      setError("CRITICAL: SDK script not found. Please ensure synclayer-sdk-web.js is in the /public folder and that your index.html includes the <script> tag.");
      console.error("Failed to find window.SynclayerSDKWeb or init() method.");
    }
  }, 500); // Allow time for script tag to load

  return () => clearTimeout(timer);
}, []);

  // Clear messages and inputs when view changes
  useEffect(() => {
    setError('');
    setSuccess('');
    setIsLoading(false);
  }, [view, migrationView]);

  const getSDK = () => {
    if (!sdkReady || !window.SynclayerSDKWeb) {
      setError('SDK is not ready. Please wait or check the console for critical errors.');
      return null;
    }
    return window.SynclayerSDKWeb;
  }

  const handleRegister = async (e) => {
    e.preventDefault();
    const SynclayerSDK = getSDK();
    if (!SynclayerSDK) return;
    
    if (!username || !password) { setError('Username and password are required.'); return; }
    setIsLoading(true);
    try {
      const result = await SynclayerSDK.register(username, password);
      if (result) {
        setSuccess(`User '${username}' registered successfully! You can now log in.`);
        setUsername('');
        setPassword('');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const SynclayerSDK = getSDK();
    if (!SynclayerSDK) return;

    if (!username || !password) { setError('Username and password are required.'); return; }
    setIsLoading(true);
    try {
      const result = await SynclayerSDK.login(username, password);
      if (result) {
        setSuccess(`Welcome back, '${username}'! Logged in successfully.`);
        setUsername('');
        setPassword('');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  // --- Migration Handlers ---
  const handleStartMigration = async (e) => {
    e.preventDefault();
    const SynclayerSDK = getSDK();
    if (!SynclayerSDK) return;

    if (!username) { setError('Enter the username for the account you are migrating.'); return; }
    setIsLoading(true);
    try {
      const result = await SynclayerSDK.startMigration(username);
      setPin(result.pin);
      setMigrationView('dest_showPin');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteMigration = async (e) => {
    e.preventDefault();
    const SynclayerSDK = getSDK();
    if (!SynclayerSDK) return;

    if (!username || !pin) { setError('Username and PIN are required.'); return; }
    setIsLoading(true);
    try {
      await SynclayerSDK.completeMigration(username, pin);
      setSuccess('Migration data sent! Go to your new device to complete the process.');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Polling effect for destination device
  useEffect(() => {
    const SynclayerSDK = getSDK();
    if (migrationView !== 'dest_showPin' || !SynclayerSDK) return;

    const intervalId = setInterval(async () => {
      try {
        const result = await SynclayerSDK.fetchAndDecryptSecret(username, pin);
        if (result.success) {
          clearInterval(intervalId);
          setMigrationView('complete');
        }
      } catch (err) {
        console.log('Polling for migration data...');
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(intervalId);
  }, [migrationView, username, pin, sdkReady]);


  const renderAuthView = () => {
    const isRegister = view === 'register';
    return (
      <form onSubmit={isRegister ? handleRegister : handleLogin}>
        <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" />
        <button type="submit" className="btn-primary" disabled={isLoading || !sdkReady}>
          {isLoading ? 'Processing...' : (isRegister ? 'Create Account' : 'Log In')}
        </button>
      </form>
    );
  };
  
  const renderMigrationView = () => {
    switch (migrationView) {
      case 'initial':
        return (
          <div className="migration-choice">
            <h3>This is my...</h3>
            <button onClick={() => setMigrationView('src_inputPin')} className="btn-secondary" disabled={!sdkReady}>Original (Source) Device</button>
            <button onClick={() => setMigrationView('dest_inputUsername')} className="btn-primary" disabled={!sdkReady}>New (Destination) Device</button>
          </div>
        );
      case 'dest_inputUsername':
        return (
          <form onSubmit={handleStartMigration}>
            <p>Enter your username to begin migrating to this device.</p>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Your username" />
            <button type="submit" className="btn-primary" disabled={isLoading || !sdkReady}>{isLoading ? 'Generating...' : 'Get Migration PIN'}</button>
          </form>
        );
      case 'dest_showPin':
        return (
          <div>
            <p>Enter this PIN on your original device:</p>
            <div className="pin-display">{pin}</div>
            <p className="waiting-text">Waiting for transfer...</p>
          </div>
        );
      case 'src_inputPin':
        return (
          <form onSubmit={handleCompleteMigration}>
            <p>Enter your username and the PIN from your new device.</p>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Your username" />
            <input type="text" value={pin} onChange={e => setPin(e.target.value)} placeholder="Migration PIN" />
            <button type="submit" className="btn-secondary" disabled={isLoading || !sdkReady}>{isLoading ? 'Sending...' : 'Send My Secret'}</button>
          </form>
        );
      case 'complete':
        return (
          <div className="success-view">
            <h3>✅ Migration Complete!</h3>
            <p>Your encrypted secret has been securely transferred to this device.</p>
          </div>
        );
      default: return null;
    }
  };

  const renderContent = () => {
    switch (view) {
      case 'register':
      case 'login':
        return renderAuthView();
      case 'migrate':
        return renderMigrationView();
      default:
        return (
          <div className="main-menu">
            <button onClick={() => setView('register')} className="btn-primary" disabled={!sdkReady}>Register</button>
            <button onClick={() => setView('login')} className="btn-primary" disabled={!sdkReady}>Login</button>
            <button onClick={() => setView('migrate')} className="btn-secondary" disabled={!sdkReady}>Migrate Device</button>
          </div>
        );
    }
  };

  return (
    <>
      <style>{`
        :root { --primary: #007bff; --secondary: #6c757d; --bg: #1a1a1a; --card-bg: #242424; --text: #f0f0f0; --border: #333; }
        body { background-color: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .wallet-container { width: 100%; max-width: 420px; background-color: var(--card-bg); border-radius: 16px; padding: 2rem; box-shadow: 0 10px 30px rgba(0,0,0,0.3); border: 1px solid var(--border); text-align: center; }
        .wallet-header { margin-bottom: 2rem; }
        .wallet-header img { width: 60px; margin-bottom: 1rem; }
        .wallet-header h2 { margin: 0; font-weight: 600; }
        .main-menu, form { display: flex; flex-direction: column; gap: 1rem; }
        input { background-color: #333; border: 1px solid #444; color: var(--text); padding: 12px; border-radius: 8px; font-size: 1rem; }
        input:focus { outline: none; border-color: var(--primary); }
        button { border: none; padding: 14px; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-primary { background-color: var(--primary); color: white; }
        .btn-primary:hover:not(:disabled) { background-color: #0056b3; }
        .btn-secondary { background-color: var(--secondary); color: white; }
        .btn-secondary:hover:not(:disabled) { background-color: #5a6268; }
        .nav-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .back-btn { background: none; color: var(--primary); padding: 0; font-size: 1rem; cursor: pointer; }
        .message { padding: 1rem; border-radius: 8px; margin-top: 1.5rem; word-break: break-word; }
        .error { background-color: #ff4d4d20; color: #ff4d4d; }
        .success { background-color: #4dff8820; color: #4dff88; }
        .pin-display { font-size: 2.5rem; font-weight: bold; letter-spacing: 0.5rem; padding: 20px; background-color: #333; border-radius: 8px; text-align: center; margin: 1rem 0; }
        .waiting-text, .success-view p, .migration-choice p { color: #aaa; }
        .debug-view { text-align: left; background-color: #2c2c2c; padding: 1rem; margin-top: 2rem; border-radius: 8px; font-size: 0.9rem; }
        .debug-view h4 { margin-top: 0; border-bottom: 1px solid #444; padding-bottom: 0.5rem; }
      `}</style>
      <div className="wallet-container">
        <div className="wallet-header">
          <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" alt="Wallet Icon" />
          <h2>Dummy Wallet</h2>
        </div>
        
        {view !== 'main' && (
          <div className="nav-header">
             <button onClick={() => { setView('main'); setMigrationView('initial'); }} className="back-btn">← Back to Menu</button>
          </div>
        )}

        {renderContent()}

        {error && <div className="message error">{error}</div>}
        {success && <div className="message success">{success}</div>}

        <DebugDbView />
      </div>
    </>
  );
}

export default App;
