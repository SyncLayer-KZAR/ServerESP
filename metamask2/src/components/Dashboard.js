import React from 'react';
import { useNavigate } from 'react-router-dom';

function Dashboard() {
  const navigate = useNavigate();

  // Handle logout
  const handleLogout = () => {
    navigate('/login');
  };

  // Handle migrate
  const handleMigrate = () => {
    // You can later replace this with actual migration logic
    navigate('/migrate');
  };

  return (
    <div className="container">
      <img
        src="/metamask-fox.png"
        alt="MetaMask Fox"
        style={{ width: '80px', marginBottom: '1rem' }}
      />
      <h2>Welcome to MetaMask2</h2>
      <p>You are now logged in!</p>

      {/* --- Migrate Button --- */}
      <button
        onClick={handleMigrate}
        style={{
          marginTop: '2rem',
          width: '100%',
          backgroundColor: '#0275d8', // Blue for primary action
          color: 'white',
          border: 'none',
          padding: '10px',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        Migrate to New Device
      </button>

      {/* --- Logout Button --- */}
      <button
        onClick={handleLogout}
        style={{
          marginTop: '1rem',
          width: '100%',
          backgroundColor: '#d9534f', // Red for destructive action
          color: 'white',
          border: 'none',
          padding: '10px',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        Logout
      </button>
    </div>
  );
}

export default Dashboard;