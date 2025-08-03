import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SynclayerSDK from './sdk/synclayerSDK';

function Register({ onRegister }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      // Call backend via SDK
      await SynclayerSDK.register(username, password);

      // Optionally notify parent
      if (onRegister) {
        onRegister({ username, password });
      }

      // Redirect to login
      navigate('/login');
    } catch (err) {
      setError(err.message || 'Registration failed');
    }
  };

  return (
    <div className="container">
      <img
        src="/metamask-fox.png"
        alt="MetaMask Fox"
        style={{ width: '80px', marginBottom: '1rem' }}
      />
      <h2>Create Account</h2>

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
          placeholder="New Password"
          value={password}
          required
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">Register</button>
      </form>

      {/* --- Added Button --- */}
      <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
        Already have an account?
      </p>
      <button
        type="button" // Prevents form submission
        onClick={() => navigate('/login')}
        style={{
          background: 'none',
          border: '1px solid #ccc',
          color: '#555',
          width: '100%',
        }}
      >
        Go to Login
      </button>
      {/* --- End of Added Button --- */}


      {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}
    </div>
  );
}

export default Register;