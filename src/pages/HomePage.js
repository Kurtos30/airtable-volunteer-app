import React from 'react';
import { Link } from 'react-router-dom';
import '../App.css';

function HomePage({ user }) {
  return (
    <div className="home-container">
      <div className="home-box">
        <h1>Welkom, {user.Roepnaam}!</h1>
        <p>Wat wil je doen?</p>
        <div className="home-navigation">
          <Link to="/kalender" className="nav-button">
            Evenementen Kalender
          </Link>
          <Link to="/profiel" className="nav-button">
            Mijn Profiel
          </Link>
          <Link to="/admin/rooster" className="nav-button">
            Bekijk Teamrooster
          </Link>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
