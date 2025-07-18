import React from 'react';
import { Link } from 'react-router-dom';
import '../App.css';

function HomePage({ user }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: window.innerWidth <= 700 ? '20px 16px' : '20px'
    }}>
      <div style={{
        background: 'white',
        padding: window.innerWidth <= 700 ? '24px 20px' : '40px',
        borderRadius: '12px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: window.innerWidth <= 700 ? '100%' : '500px',
        boxSizing: 'border-box',
        textAlign: 'center'
      }}>
        <h1 style={{
          fontSize: window.innerWidth <= 700 ? '24px' : '32px',
          marginBottom: '8px',
          color: '#333'
        }}>Welkom, {user.Roepnaam}!</h1>
        <p style={{
          fontSize: window.innerWidth <= 700 ? '16px' : '18px',
          color: '#666',
          marginBottom: '32px'
        }}>Wat wil je doen?</p>
        <div style={{
          display: 'flex',
          flexDirection: window.innerWidth <= 700 ? 'column' : 'row',
          gap: window.innerWidth <= 700 ? '12px' : '16px',
          justifyContent: 'center'
        }}>
          <Link to="/kalender" style={{
            display: 'block',
            padding: window.innerWidth <= 700 ? '16px 20px' : '20px 24px',
            backgroundColor: '#007bff',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '8px',
            fontSize: window.innerWidth <= 700 ? '16px' : '18px',
            fontWeight: '600',
            transition: 'background-color 0.3s ease',
            border: 'none',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#0056b3'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#007bff'}
          >
            Evenementen Kalender
          </Link>
          <Link to="/profiel" style={{
            display: 'block',
            padding: window.innerWidth <= 700 ? '16px 20px' : '20px 24px',
            backgroundColor: '#28a745',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '8px',
            fontSize: window.innerWidth <= 700 ? '16px' : '18px',
            fontWeight: '600',
            transition: 'background-color 0.3s ease',
            border: 'none',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#218838'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#28a745'}
          >
            Mijn Profiel
          </Link>
          <Link to="/admin/rooster" style={{
            display: 'block',
            padding: window.innerWidth <= 700 ? '16px 20px' : '20px 24px',
            backgroundColor: '#6f42c1',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '8px',
            fontSize: window.innerWidth <= 700 ? '16px' : '18px',
            fontWeight: '600',
            transition: 'background-color 0.3s ease',
            border: 'none',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#5a32a3'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#6f42c1'}
          >
            Bekijk Teamrooster
          </Link>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
