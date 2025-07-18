import React, { useState } from 'react';
import Airtable from 'airtable';
import '../App.css';

const base = new Airtable({
    apiKey: process.env.REACT_APP_AIRTABLE_API_KEY
}).base(process.env.REACT_APP_AIRTABLE_BASE_ID);

function LoginPage({ onLoginSuccess }) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showRegister, setShowRegister] = useState(false);
    const [registerName, setRegisterName] = useState('');
    const [registerEmail, setRegisterEmail] = useState('');
    const [registerLoading, setRegisterLoading] = useState(false);
    const [registerError, setRegisterError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (email.toLowerCase() === 'at@schoorsteenbrood.nl') {
            const adminUser = {
                id: 'admin_user',
                Roepnaam: 'Admin',
                isAdmin: true,
            };
            onLoginSuccess(adminUser);
            setLoading(false);
            return;
        }

        try {
            const records = await base(process.env.REACT_APP_AIRTABLE_VOLUNTEERS_TABLE_NAME)
                .select({
                    filterByFormula: `{Email Adres} = '${email}'`,
                    maxRecords: 1
                }).firstPage();

            if (records.length > 0) {
                const user = { id: records[0].id, ...records[0].fields };
                onLoginSuccess(user);
            } else {
                setError('E-mailadres niet gevonden. Probeer het opnieuw.');
            }
        } catch (err) {
            setError('Er is een fout opgetreden. Controleer de configuratie.');
            console.error(err);
        }
        setLoading(false);
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setRegisterLoading(true);
        setRegisterError('');
        try {
            // Check if email already exists
            const records = await base(process.env.REACT_APP_AIRTABLE_VOLUNTEERS_TABLE_NAME)
                .select({
                    filterByFormula: `{Email Adres} = '${registerEmail}'`,
                    maxRecords: 1
                }).firstPage();
            if (records.length > 0) {
                setRegisterError('Dit e-mailadres is al geregistreerd. Log in of gebruik een ander e-mailadres.');
                setRegisterLoading(false);
                return;
            }
            // Add new user
            const created = await base(process.env.REACT_APP_AIRTABLE_VOLUNTEERS_TABLE_NAME).create([
                { fields: { 
                    'Roepnaam': registerName, 
                    'Voornaam': registerName, 
                    'Achternaam': '', 
                    'Email Adres': registerEmail 
                } }
            ]);
            const user = { id: created[0].id, ...created[0].fields };
            onLoginSuccess(user);
        } catch (err) {
            setRegisterError('Registratie mislukt. Probeer het opnieuw.');
            console.error(err);
        }
        setRegisterLoading(false);
    };

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
                maxWidth: window.innerWidth <= 700 ? '100%' : '400px',
                boxSizing: 'border-box'
            }}>
                <h1 style={{
                    fontSize: window.innerWidth <= 700 ? '24px' : '28px',
                    marginBottom: '12px',
                    textAlign: 'center',
                    color: '#333'
                }}>Inloggen</h1>
                <p style={{
                    fontSize: window.innerWidth <= 700 ? '14px' : '16px',
                    color: '#666',
                    textAlign: 'center',
                    marginBottom: '24px'
                }}>Log in met het e-mailadres dat bekend is bij de organisatie.</p>
                <form onSubmit={handleLogin} style={{ marginBottom: '16px' }}>
                    <input
                        type="email"
                        placeholder="jouw.email@voorbeeld.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{
                            width: '100%',
                            padding: window.innerWidth <= 700 ? '12px 16px' : '14px 16px',
                            fontSize: window.innerWidth <= 700 ? '16px' : '16px',
                            border: '2px solid #e1e5e9',
                            borderRadius: '8px',
                            marginBottom: '16px',
                            boxSizing: 'border-box',
                            outline: 'none',
                            transition: 'border-color 0.3s ease'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#007bff'}
                        onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
                    />
                    <button 
                        type="submit" 
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: window.innerWidth <= 700 ? '14px 20px' : '16px 20px',
                            fontSize: window.innerWidth <= 700 ? '16px' : '16px',
                            backgroundColor: loading ? '#ccc' : '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontWeight: '600',
                            transition: 'background-color 0.3s ease'
                        }}
                        onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = '#0056b3')}
                        onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = '#007bff')}
                    >
                        {loading ? 'Bezig met inloggen...' : 'Inloggen'}
                    </button>
                </form>
                {error && <p style={{
                    color: '#dc3545',
                    fontSize: window.innerWidth <= 700 ? '14px' : '14px',
                    textAlign: 'center',
                    marginBottom: '16px',
                    padding: '8px',
                    background: '#f8d7da',
                    borderRadius: '4px',
                    border: '1px solid #f5c6cb'
                }}>{error}</p>}
                <button 
                    type="button" 
                    onClick={() => setShowRegister(v => !v)} 
                    style={{
                        width: '100%',
                        marginTop: '16px',
                        background: 'none',
                        border: 'none',
                        color: '#007bff',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontSize: window.innerWidth <= 700 ? '14px' : '14px',
                        padding: '8px'
                    }}
                >
                    {showRegister ? 'Annuleer registratie' : 'Nog geen account? Meld je aan!'}
                </button>
                {showRegister && (
                    <form onSubmit={handleRegister} style={{
                        marginTop: '20px',
                        background: '#f8f9fa',
                        padding: window.innerWidth <= 700 ? '20px 16px' : '24px',
                        borderRadius: '8px',
                        border: '1px solid #e9ecef'
                    }}>
                        <h2 style={{
                            marginTop: 0,
                            marginBottom: '16px',
                            fontSize: window.innerWidth <= 700 ? '20px' : '22px',
                            color: '#333'
                        }}>Nieuwe gebruiker aanmelden</h2>
                        <input
                            type="text"
                            placeholder="Jouw naam"
                            value={registerName}
                            onChange={e => setRegisterName(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: window.innerWidth <= 700 ? '12px 16px' : '14px 16px',
                                fontSize: window.innerWidth <= 700 ? '16px' : '16px',
                                border: '2px solid #e1e5e9',
                                borderRadius: '8px',
                                marginBottom: '12px',
                                boxSizing: 'border-box',
                                outline: 'none',
                                transition: 'border-color 0.3s ease'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#007bff'}
                            onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
                        />
                        <input
                            type="email"
                            placeholder="E-mailadres"
                            value={registerEmail}
                            onChange={e => setRegisterEmail(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: window.innerWidth <= 700 ? '12px 16px' : '14px 16px',
                                fontSize: window.innerWidth <= 700 ? '16px' : '16px',
                                border: '2px solid #e1e5e9',
                                borderRadius: '8px',
                                marginBottom: '16px',
                                boxSizing: 'border-box',
                                outline: 'none',
                                transition: 'border-color 0.3s ease'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#007bff'}
                            onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
                        />
                        <button 
                            type="submit" 
                            disabled={registerLoading}
                            style={{
                                width: '100%',
                                padding: window.innerWidth <= 700 ? '14px 20px' : '16px 20px',
                                fontSize: window.innerWidth <= 700 ? '16px' : '16px',
                                backgroundColor: registerLoading ? '#ccc' : '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: registerLoading ? 'not-allowed' : 'pointer',
                                fontWeight: '600',
                                transition: 'background-color 0.3s ease'
                            }}
                            onMouseEnter={(e) => !registerLoading && (e.target.style.backgroundColor = '#218838')}
                            onMouseLeave={(e) => !registerLoading && (e.target.style.backgroundColor = '#28a745')}
                        >
                            {registerLoading ? 'Bezig met aanmelden...' : 'Aanmelden'}
                        </button>
                        {registerError && <p style={{
                            color: '#dc3545',
                            fontSize: window.innerWidth <= 700 ? '14px' : '14px',
                            textAlign: 'center',
                            marginTop: '12px',
                            padding: '8px',
                            background: '#f8d7da',
                            borderRadius: '4px',
                            border: '1px solid #f5c6cb'
                        }}>{registerError}</p>}
                    </form>
                )}
            </div>
        </div>
    );
}

export default LoginPage;
