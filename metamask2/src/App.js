import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Register from './components/Register';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Migrate from './components/Migrate';

function App() {
  const [users, setUsers] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleRegister = (newUser) => {
    setUsers([...users, newUser]);
  };

  const handleLogin = (credentials) => {
    const userFound = users.find(
      (u) => u.email === credentials.email && u.password === credentials.password
    );
    if (userFound) {
      setIsLoggedIn(true);
      return true;
    }
    return false;
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route
          path="/register"
          element={<Register onRegister={handleRegister} />}
        />
        <Route
          path="/login"
          element={<Login onLogin={handleLogin} isLoggedIn={isLoggedIn} />}
        />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/migrate" element={<Migrate />} />

      </Routes>
    </Router>
  );
}

export default App;