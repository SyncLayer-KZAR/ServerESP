// src/components/Migrate.js
import React, { useState, useEffect } from 'react';
import SynclayerSDK from './sdk/synclayerSDK';
import { openDB } from 'idb'; // Import openDB for the debug view

// --- Debug View Component ---
// This component will read directly from IndexedDB to show you the current state.
function DebugDbView() {
  const [dbState, setDbState] = useState({ E_S: '...', S2: '...' });

  const checkDb = async () => {
    try {
      const db = await openDB('SyncLayerDB', 1);
      const e_s_val = await db.get('keys', 'synclayer_E_S');
      const s2_val = await db.get('keys', 'synclayer_S2');
      
      setDbState({
        E_S: e_s_val ? e_s_val.substring(0, 25) + '...' : 'Not Set',
        // We only check for presence of the private key, we don't display it.
        S2: s2_val ? 'Present' : 'Not Set'
      });
    } catch (e) {
      setDbState({ E_S: 'Error reading DB', S2: 'Error reading DB' });
      console.error("Error reading from DB for debug view:", e);
    }
  };

  // Run the check when the component loads
  useEffect(() => {
    checkDb();
  }, []);

  return (
    <div style={{ border: '1px solid #ddd', padding: '15px', marginTop: '2.5rem', borderRadius: '8px', backgroundColor: '#f9f9f9', textAlign: 'left' }}>
      <h4 style={{ marginTop: 0, borderBottom: '1px solid #ddd', paddingBottom: '10px', marginBottom: '10px' }}>⚙️ IndexedDB Debug View</h4>
      <p style={{margin: '5px 0'}}><strong>E_S (User Secret):</strong> {dbState.E_S}</p>
      <p style={{margin: '5px 0'}}><strong>S2 (Migration Key):</strong> {dbState.S2}</p>
      <button onClick={checkDb} style={{width: 'auto', padding: '5px 10px', fontSize: '0.8rem', marginTop: '10px'}}>Refresh</button>
    </div>
  );
}


function Migrate() {
  const [view, setView] = useState('initial'); // 'initial', 'dest_inputUsername', 'dest_showPin', 'src_inputPin', 'migrationComplete'
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // This useEffect hook handles the polling logic
  useEffect(() => {
    // Do nothing if we are not in the 'showPin' view
    if (view !== 'dest_showPin') {
      return;
    }

    // Set up an interval to check for the migration data every 10 seconds
    const intervalId = setInterval(async () => {
      try {
        const result = await SynclayerSDK.fetchAndDecryptSecret(username, pin);
        if (result.success) {
          // If successful, clear the interval and update the UI
          clearInterval(intervalId);
          setView('migrationComplete');
        }
      } catch (err) {
        // This error is expected until the source device completes its part.
        // We don't need to show it to the user.
        console.log('Polling for migration data...');
      }
    }, 10000); // Poll every 10 seconds

    // Cleanup function: this is crucial to stop the interval
    // when the component unmounts or the view changes.
    return () => clearInterval(intervalId);

  }, [view, username, pin]); // Rerun this effect if the view, username, or pin changes

  // --- Single, correct definition of functions ---
  const resetState = () => {
    setIsLoading(false);
    setError('');
    setSuccess('');
    setUsername('');
    setPin('');
  };

  const handleSourceClick = () => {
    resetState();
    setView('src_inputPin');
  };

  const handleDestinationClick = () => {
    resetState();
    setView('dest_inputUsername');
  };

  const handleDestUsernameSubmit = async (e) => {
    e.preventDefault();
    if (!username) { setError('Please enter a username.'); return; }
    setIsLoading(true);
    setError('');
    try {
      const result = await SynclayerSDK.startMigration(username);
      setPin(result.pin);
      setView('dest_showPin');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSrcPinSubmit = async (e) => {
    e.preventDefault();
    if (!pin || !username) { setError('Please enter both username and PIN.'); return; }
    setIsLoading(true);
    setError('');
    setSuccess('');
    try {
      await SynclayerSDK.completeMigration(username, pin);
      setSuccess('Migration data sent successfully! You can now complete the process on your destination device.');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const renderView = () => {
    switch (view) {
      case 'dest_inputUsername':
        return (
          <form onSubmit={handleDestUsernameSubmit}>
            <p>Enter your username to begin migration to this new device.</p>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username" disabled={isLoading} />
            <button type="submit" disabled={isLoading}>{isLoading ? 'Generating...' : 'Get Migration PIN'}</button>
            {error && <p className="error-text">{error}</p>}
          </form>
        );
      case 'dest_showPin':
        return (
          <div>
            <p>Enter the following PIN on your original (source) device:</p>
            <div className="pin-display">{pin}</div>
            <p style={{color: '#666', fontStyle: 'italic'}}>Waiting for source device to complete transfer...</p>
          </div>
        );
      case 'src_inputPin':
        return (
          <form onSubmit={handleSrcPinSubmit}>
            <p>Enter your username and the PIN from your new device.</p>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username" disabled={isLoading} />
            {/* *** FIX: Removed .toUpperCase() to allow mixed-case PINs *** */}
            <input type="text" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Enter Migration PIN" disabled={isLoading} />
            <button type="submit" disabled={isLoading}>{isLoading ? 'Sending...' : 'Complete Migration'}</button>
            {error && <p className="error-text">{error}</p>}
            {success && <p className="success-text">{success}</p>}
          </form>
        );
      case 'migrationComplete':
        return (
          <div>
            <h3 style={{ color: 'green' }}>✅ Migration Complete!</h3>
            <p>Your secret has been securely transferred to this device.</p>
            <p>You can now log in normally.</p>
            <button onClick={() => setView('initial')}>Back to Start</button>
          </div>
        );
      default:
        return (
          <>
            <p>Choose the role of this device:</p>
            <button onClick={handleSourceClick} className="btn-source">Source Device</button>
            <button onClick={handleDestinationClick} className="btn-destination">Destination Device</button>
          </>
        );
    }
  };

  return (
    <div className="container" style={{ textAlign: 'center', maxWidth: '400px', margin: '2rem auto' }}>
      <style>{`
        .container input { width: 100%; padding: 10px; margin-bottom: 1rem; border-radius: 5px; border: 1px solid #ccc; box-sizing: border-box; }
        .container button { width: 100%; background-color: #007bff; color: white; border: none; padding: 12px; border-radius: 5px; cursor: pointer; font-size: 1rem; }
        .container button:disabled { background-color: #ccc; }
        .btn-source { background-color: #5bc0de !important; margin-bottom: 1rem; }
        .btn-destination { background-color: #5cb85c !important; }
        .pin-display { font-size: 2.5rem; font-weight: bold; letter-spacing: 0.5rem; padding: 20px; background-color: #f0f0f0; border-radius: 8px; text-align: center; margin: 1rem 0; }
        .error-text { color: red; margin-top: 1rem; }
        .success-text { color: green; margin-top: 1rem; }
      `}</style>
      <img src="/metamask-fox.png" alt="MetaMask Fox" style={{ width: '80px', marginBottom: '1rem' }} />
      <h2>Device Migration</h2>
      <div style={{ marginTop: '1.5rem' }}>
        {renderView()}
      </div>
      
      {/* --- RENDER THE DEBUG VIEW AT THE BOTTOM --- */}
      <DebugDbView />
    </div>
  );
}

export default Migrate;
