// src/components/Login.js

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SynclayerSDK from './sdk/synclayerSDK';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors

    try {
      // Call the SDK's login method
      await SynclayerSDK.login(username, password);

      // On success, navigate to the dashboard
      navigate('/dashboard');

    } catch (err) {
      // On failure, display the error message from the SDK
      setError(err.message || 'Invalid credentials');
    }
  };

  return (
    <div className="container">
      <img
        src="/metamask-fox.png"
        alt="MetaMask Fox"
        style={{ width: '80px', marginBottom: '1rem' }}
      />
      <h2>Login to MetaMask2</h2>
      {error && <p style={{ color: 'red', fontSize: '0.9rem' }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          required
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          required
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">Login</button>
      </form>

      {/* --- Added Button --- */}
      <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
        Don't have an account?
      </p>
      <button
        type="button" // Prevents form submission
        onClick={() => navigate('/register')}
        style={{
          background: 'none',
          border: '1px solid #ccc',
          color: '#555',
          width: '100%',
        }}
      >
        Go to Register
      </button>
      {/* --- End of Added Button --- */}

    </div>
  );
}

export default Login;