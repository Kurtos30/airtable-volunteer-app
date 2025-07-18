import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Airtable from 'airtable';
import { useTheme } from '../App';
import '../App.css';
// Voeg axios toe voor upload
import axios from 'axios';

const base = new Airtable({
    apiKey: process.env.REACT_APP_AIRTABLE_API_KEY
}).base(process.env.REACT_APP_AIRTABLE_BASE_ID);

function ProfilePage({ user, onUserUpdate }) {
    const { theme, setTheme } = useTheme();
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [registeredEvents, setRegisteredEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(true);
    const [confirmUnregister, setConfirmUnregister] = useState(null); // eventId waarvoor bevestiging
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    useEffect(() => {
        if (user) {
            setFormData({
                'Roepnaam': user.Roepnaam || '',
                'Naam': user.Naam || '',
                'Officiële naam': user['Officiële naam'] || '',
                'Pronounce': user['Pronounce'] || '',
                'Geboortedatum': user['Geboortedatum'] || '',
                'Zijn er dingen die we moeten weten met betrekking tot eten?': user['Zijn er dingen die we moeten weten met betrekking tot eten?'] || '',
                'Contactpersoon indien jonger dan 20': user['Contactpersoon indien jonger dan 20'] || '',
                'Rijbewijs?': user['Rijbewijs?'] || '',
                'Eigen auto?': user['Eigen auto?'] || '',
                'Heb jij een eigen, door ons goedgekeurd, kostuum?': user['Heb jij een eigen, door ons goedgekeurd, kostuum?'] || '',
                'Beschikbaarheid': user['Beschikbaarheid'] || '',
                'Opsomming allergiën': user['Opsomming allergiën'] || '',
                'Belangrijk om te weten': user['Belangrijk om te weten'] || '',
                'Photo': user['Photo'] || '',
                'Email Adres': user['Email Adres'] || '',
                'Telefoon nummer': user['Telefoon nummer'] || '',
                'Adres': user.Adres || '',
                'Postcode': user.Postcode || '',
                'Stad': user.Stad || '',
            });
        }

        const fetchRegisteredEvents = async () => {
            // Extract event IDs from registrations
            const eventIds = user['Opgegeven Evenementen'] || [];
            
            if (eventIds.length === 0) {
                setRegisteredEvents([]);
                setEventsLoading(false);
                return;
            }
            
            const filterFormula = "OR(" + eventIds.map(id => `RECORD_ID() = '${id}'`).join(',') + ")";

            try {
                const records = await base(process.env.REACT_APP_AIRTABLE_TABLE_NAME)
                    .select({ filterByFormula: filterFormula })
                    .all();
                
                // Map events (simplified - no multi-day details for now)
                const eventsWithDetails = records.map(rec => {
                    return { 
                        id: rec.id, 
                        ...rec.fields,
                        registration: null // No detailed registration info for now
                    };
                });
                
                setRegisteredEvents(eventsWithDetails);
            } catch (err) {
                console.error("Fout bij ophalen inschrijvingen:", err);
            }
            setEventsLoading(false);
        };

        fetchRegisteredEvents();
    }, [user]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const updatedFields = { ...formData };
            // Note: 'Naam' is a formula field in your base, so we can't update it.
            // Let's remove it from the update payload.
            delete updatedFields.Naam; 
            
            const updatedRecord = await base(process.env.REACT_APP_AIRTABLE_VOLUNTEERS_TABLE_NAME).update(user.id, updatedFields);
            onUserUpdate({ id: user.id, ...updatedRecord.fields });
            setIsEditing(false);
        } catch (err) {
            setError('Fout bij het opslaan van de gegevens.');
            console.error(err);
        }
        setLoading(false);
    };

    // Uitschrijf handler
    const handleUnregister = async (eventId) => {
        if (!window.confirm('Weet je zeker dat je je wilt uitschrijven voor dit evenement?')) return;
        try {
            const currentRegistrations = user['Opgegeven Evenementen'] || [];
            const newRegistrations = currentRegistrations.filter(reg => reg !== eventId);
            const updatedRecord = await base(process.env.REACT_APP_AIRTABLE_VOLUNTEERS_TABLE_NAME).update(user.id, {
                'Opgegeven Evenementen': newRegistrations,
            });
            onUserUpdate({ id: user.id, ...updatedRecord.fields });
            setConfirmUnregister(null); // Sluit dialoog na succesvolle unregistration
        } catch (err) {
            alert('Fout bij uitschrijven. Probeer het opnieuw.');
        }
    };

    // Handler voor foto uploaden
    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadingPhoto(true);
        try {
            // Upload naar ImgBB
            const formData = new FormData();
            formData.append('image', await toBase64(file).then(b64 => b64.split(',')[1]));
            const res = await axios.post(`https://api.imgbb.com/1/upload?key=${process.env.REACT_APP_IMGBB_API_KEY}`, formData);
            const imageUrl = res.data.data.url;
            // Update Airtable
            const updatedRecord = await base(process.env.REACT_APP_AIRTABLE_VOLUNTEERS_TABLE_NAME).update(user.id, {
                'Photo': [{ url: imageUrl }]
            });
            onUserUpdate({ id: user.id, ...updatedRecord.fields });
        } catch (err) {
            alert('Fout bij uploaden van foto. Probeer opnieuw.');
        }
        setUploadingPhoto(false);
    };
    // Helper om bestand naar base64 te converteren
    function toBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    // Helper om veilig een veld te tonen
    function renderField(val) {
        if (val == null) return '';
        if (typeof val === 'object') {
            if ('value' in val) return val.value;
            if ('name' in val) return val.name;
            if (Array.isArray(val)) return val.map(renderField).join(', ');
            return JSON.stringify(val);
        }
        return val;
    }

    if (!user) {
        return <div>Laden...</div>;
    }

    return (
        <div style={{
            maxWidth: 600,
            margin: '0 auto',
            padding: window.innerWidth <= 700 ? '12px 8px' : '16px',
            marginBottom: '20px',
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            width: '100%',
            boxSizing: 'border-box'
        }}>
            {isEditing ? (
                <form onSubmit={handleSave} style={{ padding: window.innerWidth <= 700 ? '16px' : '24px' }}>
                    <h1 style={{ 
                        fontSize: window.innerWidth <= 700 ? '24px' : '32px', 
                        marginBottom: '15px',
                        color: '#333'
                    }}>
                        Profiel Bewerken
                    </h1>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: window.innerWidth <= 700 ? '12px' : '16px',
                        marginBottom: '20px'
                    }}>
                        <div>
                            <label style={{
                                display: 'block',
                                marginBottom: '6px',
                                fontSize: window.innerWidth <= 700 ? '14px' : '16px',
                                fontWeight: '600',
                                color: '#333'
                            }}>Roepnaam</label>
                            <input 
                                type="text" 
                                name="Roepnaam" 
                                value={formData.Roepnaam} 
                                onChange={handleChange}
                                style={{
                                    width: '100%',
                                    padding: window.innerWidth <= 700 ? '12px 16px' : '14px 16px',
                                    fontSize: window.innerWidth <= 700 ? '16px' : '16px',
                                    border: '2px solid #e1e5e9',
                                    borderRadius: '8px',
                                    boxSizing: 'border-box',
                                    outline: 'none',
                                    transition: 'border-color 0.3s ease'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#007bff'}
                                onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
                            />
                        </div>
                        
                        <div>
                            <label style={{
                                display: 'block',
                                marginBottom: '6px',
                                fontSize: window.innerWidth <= 700 ? '14px' : '16px',
                                fontWeight: '600',
                                color: '#333'
                            }}>Volledige Naam</label>
                            <input 
                                type="text" 
                                name="Naam" 
                                value={formData.Naam} 
                                disabled
                                style={{
                                    width: '100%',
                                    padding: window.innerWidth <= 700 ? '12px 16px' : '14px 16px',
                                    fontSize: window.innerWidth <= 700 ? '16px' : '16px',
                                    border: '2px solid #e1e5e9',
                                    borderRadius: '8px',
                                    boxSizing: 'border-box',
                                    backgroundColor: '#f8f9fa',
                                    color: '#6c757d'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{
                                display: 'block',
                                marginBottom: '6px',
                                fontSize: window.innerWidth <= 700 ? '14px' : '16px',
                                fontWeight: '600',
                                color: '#333'
                            }}>Email</label>
                            <input 
                                type="email" 
                                name="Email Adres" 
                                value={formData['Email Adres']} 
                                onChange={handleChange}
                                style={{
                                    width: '100%',
                                    padding: window.innerWidth <= 700 ? '12px 16px' : '14px 16px',
                                    fontSize: window.innerWidth <= 700 ? '16px' : '16px',
                                    border: '2px solid #e1e5e9',
                                    borderRadius: '8px',
                                    boxSizing: 'border-box',
                                    outline: 'none',
                                    transition: 'border-color 0.3s ease'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#007bff'}
                                onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
                            />
                        </div>

                        <div>
                            <label style={{
                                display: 'block',
                                marginBottom: '6px',
                                fontSize: window.innerWidth <= 700 ? '14px' : '16px',
                                fontWeight: '600',
                                color: '#333'
                            }}>Telefoon</label>
                            <input 
                                type="tel" 
                                name="Telefoon nummer" 
                                value={formData['Telefoon nummer']} 
                                onChange={handleChange}
                                style={{
                                    width: '100%',
                                    padding: window.innerWidth <= 700 ? '12px 16px' : '14px 16px',
                                    fontSize: window.innerWidth <= 700 ? '16px' : '16px',
                                    border: '2px solid #e1e5e9',
                                    borderRadius: '8px',
                                    boxSizing: 'border-box',
                                    outline: 'none',
                                    transition: 'border-color 0.3s ease'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#007bff'}
                                onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
                            />
                        </div>
                        
                        <div>
                            <label style={{
                                display: 'block',
                                marginBottom: '6px',
                                fontSize: window.innerWidth <= 700 ? '14px' : '16px',
                                fontWeight: '600',
                                color: '#333'
                            }}>Adres</label>
                            <input 
                                type="text" 
                                name="Adres" 
                                value={formData.Adres} 
                                onChange={handleChange}
                                style={{
                                    width: '100%',
                                    padding: window.innerWidth <= 700 ? '12px 16px' : '14px 16px',
                                    fontSize: window.innerWidth <= 700 ? '16px' : '16px',
                                    border: '2px solid #e1e5e9',
                                    borderRadius: '8px',
                                    boxSizing: 'border-box',
                                    outline: 'none',
                                    transition: 'border-color 0.3s ease'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#007bff'}
                                onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
                            />
                        </div>
                        
                        <div>
                            <label style={{
                                display: 'block',
                                marginBottom: '6px',
                                fontSize: window.innerWidth <= 700 ? '14px' : '16px',
                                fontWeight: '600',
                                color: '#333'
                            }}>Postcode</label>
                            <input 
                                type="text" 
                                name="Postcode" 
                                value={formData.Postcode} 
                                onChange={handleChange}
                                style={{
                                    width: '100%',
                                    padding: window.innerWidth <= 700 ? '12px 16px' : '14px 16px',
                                    fontSize: window.innerWidth <= 700 ? '16px' : '16px',
                                    border: '2px solid #e1e5e9',
                                    borderRadius: '8px',
                                    boxSizing: 'border-box',
                                    outline: 'none',
                                    transition: 'border-color 0.3s ease'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#007bff'}
                                onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
                            />
                        </div>
                        
                        <div>
                            <label style={{
                                display: 'block',
                                marginBottom: '6px',
                                fontSize: window.innerWidth <= 700 ? '14px' : '16px',
                                fontWeight: '600',
                                color: '#333'
                            }}>Stad</label>
                            <input 
                                type="text" 
                                name="Stad" 
                                value={formData.Stad} 
                                onChange={handleChange}
                                style={{
                                    width: '100%',
                                    padding: window.innerWidth <= 700 ? '12px 16px' : '14px 16px',
                                    fontSize: window.innerWidth <= 700 ? '16px' : '16px',
                                    border: '2px solid #e1e5e9',
                                    borderRadius: '8px',
                                    boxSizing: 'border-box',
                                    outline: 'none',
                                    transition: 'border-color 0.3s ease'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#007bff'}
                                onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
                            />
                        </div>
                    </div>
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
                    <div style={{
                        display: 'flex',
                        flexDirection: window.innerWidth <= 700 ? 'column' : 'row',
                        gap: window.innerWidth <= 700 ? '12px' : '12px',
                        marginTop: 24,
                        marginBottom: '20px'
                    }}>
                        <button 
                            type="submit" 
                            disabled={loading}
                            style={{
                                padding: window.innerWidth <= 700 ? '14px 20px' : '12px 24px',
                                fontSize: window.innerWidth <= 700 ? '16px' : '16px',
                                backgroundColor: loading ? '#ccc' : '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                fontWeight: '600',
                                transition: 'background-color 0.3s ease',
                                flex: window.innerWidth <= 700 ? 'none' : 1
                            }}
                            onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = '#0056b3')}
                            onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = '#007bff')}
                        >
                            {loading ? 'Opslaan...' : 'Opslaan'}
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setIsEditing(false)}
                            style={{
                                padding: window.innerWidth <= 700 ? '14px 20px' : '12px 24px',
                                fontSize: window.innerWidth <= 700 ? '16px' : '16px',
                                backgroundColor: '#6c757d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                transition: 'background-color 0.3s ease',
                                flex: window.innerWidth <= 700 ? 'none' : 1
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#5a6268'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = '#6c757d'}
                        >
                            Annuleren
                        </button>
                    </div>
                </form>
            ) : (
                <>
                    <div style={{ padding: window.innerWidth <= 700 ? '16px' : '24px' }}>
                        <h1 style={{ 
                            fontSize: window.innerWidth <= 700 ? '24px' : '32px', 
                            marginBottom: '15px',
                            color: '#333'
                        }}>
                            Mijn Profiel
                        </h1>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: window.innerWidth <= 700 ? '16px' : '20px',
                            marginBottom: '20px'
                        }}>
                            <div>
                                <h3 style={{ 
                                    fontSize: window.innerWidth <= 700 ? '18px' : '20px',
                                    marginBottom: '12px',
                                    color: '#333',
                                    borderBottom: '2px solid #e9ecef',
                                    paddingBottom: '8px'
                                }}>Persoonlijke info</h3>
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px'
                                }}>
                                    <p style={{ fontSize: window.innerWidth <= 700 ? '14px' : '16px' }}>
                                        <strong>Officiële naam:</strong> {renderField(user['Officiële naam'])}
                                    </p>
                                    <p style={{ fontSize: window.innerWidth <= 700 ? '14px' : '16px' }}>
                                        <strong>Roepnaam:</strong> {user.Roepnaam}
                                    </p>
                                    <p style={{ fontSize: window.innerWidth <= 700 ? '14px' : '16px' }}>
                                        <strong>Volledige Naam:</strong> {user.Naam}
                                    </p>
                                    <p style={{ fontSize: window.innerWidth <= 700 ? '14px' : '16px' }}>
                                        <strong>Geboortedatum:</strong> {user['Geboortedatum']}
                                    </p>
                                    <p style={{ fontSize: window.innerWidth <= 700 ? '14px' : '16px' }}>
                                        <strong>Pronouns:</strong> {user['Pronounce']}
                                    </p>
                                    <p style={{ fontSize: window.innerWidth <= 700 ? '14px' : '16px' }}>
                                        <strong>Kostuum:</strong> {renderField(user['Heb jij een eigen, door ons goedgekeurd, kostuum?'])}
                                    </p>
                                    <p style={{ fontSize: window.innerWidth <= 700 ? '14px' : '16px' }}>
                                        <strong>Beschikbaarheid:</strong> {renderField(user['Beschikbaarheid'])}
                                    </p>
                                    <p style={{ fontSize: window.innerWidth <= 700 ? '14px' : '16px' }}>
                                        <strong>Allergieën:</strong> {renderField(user['Opsomming allergiën'])}
                                    </p>
                                    <p style={{ fontSize: window.innerWidth <= 700 ? '14px' : '16px' }}>
                                        <strong>Belangrijk om te weten:</strong> {renderField(user['Belangrijk om te weten'])}
                                    </p>
                                </div>
                            </div>

                            {user['Photo'] && (
                                <div style={{ textAlign: 'center' }}>
                                    <strong style={{ fontSize: window.innerWidth <= 700 ? '14px' : '16px' }}>Foto:</strong><br/>
                                    <img 
                                        src={user['Photo'][0]?.url || user['Photo']} 
                                        alt="Profiel" 
                                        style={{
                                            maxWidth: window.innerWidth <= 700 ? '80vw' : '60vw',
                                            maxHeight: 180,
                                            borderRadius: 12,
                                            margin: '8px auto',
                                            boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                                        }} 
                                    />
                                </div>
                            )}

                            <div style={{ marginTop: 10 }}>
                                <label style={{
                                    display: 'block',
                                    marginBottom: 8,
                                    fontSize: window.innerWidth <= 700 ? '14px' : '16px',
                                    fontWeight: '600',
                                    color: '#333'
                                }}>Profiel foto wijzigen:</label>
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    capture="environment" 
                                    onChange={handlePhotoUpload} 
                                    disabled={uploadingPhoto}
                                    style={{
                                        width: '100%',
                                        padding: window.innerWidth <= 700 ? '8px' : '12px',
                                        fontSize: window.innerWidth <= 700 ? '14px' : '16px',
                                        border: '2px solid #e1e5e9',
                                        borderRadius: '8px',
                                        boxSizing: 'border-box'
                                    }}
                                />
                                {uploadingPhoto && (
                                    <span style={{ 
                                        fontSize: window.innerWidth <= 700 ? '14px' : '16px',
                                        color: '#007bff',
                                        marginTop: '8px',
                                        display: 'block'
                                    }}>
                                        Bezig met uploaden...
                                    </span>
                                )}
                            </div>

                            <div>
                                <h3 style={{ 
                                    fontSize: window.innerWidth <= 700 ? '18px' : '20px',
                                    marginBottom: '12px',
                                    color: '#333',
                                    borderBottom: '2px solid #e9ecef',
                                    paddingBottom: '8px'
                                }}>Contact</h3>
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px'
                                }}>
                                    <p style={{ fontSize: window.innerWidth <= 700 ? '14px' : '16px' }}>
                                        <strong>Email:</strong> {user['Email Adres']}
                                    </p>
                                    <p style={{ fontSize: window.innerWidth <= 700 ? '14px' : '16px' }}>
                                        <strong>Telefoon:</strong> {user['Telefoon nummer']}
                                    </p>
                                    <p style={{ fontSize: window.innerWidth <= 700 ? '14px' : '16px' }}>
                                        <strong>Adres:</strong> {user.Adres}, {user.Postcode} {user.Stad}
                                    </p>
                                    <p style={{ fontSize: window.innerWidth <= 700 ? '14px' : '16px' }}>
                                        <strong>Contactpersoon indien jonger dan 20:</strong> {renderField(user['Contactpersoon indien jonger dan 20'])}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <h3 style={{ 
                                    fontSize: window.innerWidth <= 700 ? '18px' : '20px',
                                    marginBottom: '12px',
                                    color: '#333',
                                    borderBottom: '2px solid #e9ecef',
                                    paddingBottom: '8px'
                                }}>Overig</h3>
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px'
                                }}>
                                    <p style={{ fontSize: window.innerWidth <= 700 ? '14px' : '16px' }}>
                                        <strong>Rijbewijs:</strong> {renderField(user['Rijbewijs?'])}
                                    </p>
                                    <p style={{ fontSize: window.innerWidth <= 700 ? '14px' : '16px' }}>
                                        <strong>Eigen auto:</strong> {renderField(user['Eigen auto?'])}
                                    </p>
                                    <p style={{ fontSize: window.innerWidth <= 700 ? '14px' : '16px' }}>
                                        <strong>Zijn er dingen die we moeten weten met betrekking tot eten?</strong> {renderField(user['Zijn er dingen die we moeten weten met betrekking tot eten?'])}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{
                        marginBottom: '20px',
                        padding: window.innerWidth <= 700 ? '16px' : '24px',
                        background: '#f8f9fa',
                        borderRadius: '8px',
                        border: '1px solid #e9ecef'
                    }}>
                        <label htmlFor="theme-select" style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontSize: window.innerWidth <= 700 ? '14px' : '16px',
                            fontWeight: '600',
                            color: '#333'
                        }}>Thema:</label>
                        <select 
                            id="theme-select" 
                            value={theme} 
                            onChange={(e) => setTheme(e.target.value)}
                            style={{
                                width: '100%',
                                padding: window.innerWidth <= 700 ? '12px 16px' : '14px 16px',
                                fontSize: window.innerWidth <= 700 ? '16px' : '16px',
                                border: '2px solid #e1e5e9',
                                borderRadius: '8px',
                                boxSizing: 'border-box',
                                outline: 'none',
                                transition: 'border-color 0.3s ease'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#007bff'}
                            onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
                        >
                            <option value="light">Licht</option>
                            <option value="dark">Donker</option>
                            <option value="nature">Natuur</option>
                            <option value="cyberpunk">Cyberpunk</option>
                            <option value="ocean">Oceaan</option>
                            <option value="retro">Retro</option>
                            <option value="pastel">Pastel</option>
                            <option value="halloween">Halloween</option>
                            <option value="solarized">Solarized</option>
                            <option value="high-contrast">High Contrast</option>
                            <option value="christmas">Kerst</option>
                            <option value="spring">Lente</option>
                            <option value="summer">Zomer</option>
                            <option value="autumn">Herfst</option>
                            <option value="mushroom">Mushroom</option>
                        </select>
                    </div>

                    <div style={{
                        marginBottom: '20px',
                        padding: window.innerWidth <= 700 ? '16px' : '24px'
                    }}>
                        <h2 style={{ 
                            fontSize: window.innerWidth <= 700 ? '20px' : '24px',
                            marginBottom: '16px',
                            color: '#333'
                        }}>Mijn Inschrijvingen</h2>
                        {eventsLoading ? (
                            <p style={{
                                fontSize: window.innerWidth <= 700 ? '14px' : '16px',
                                color: '#666',
                                textAlign: 'center',
                                padding: '20px'
                            }}>Inschrijvingen laden...</p>
                        ) : registeredEvents.length > 0 ? (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px'
                            }}>
                                {registeredEvents.map(event => {
                                    const startDate = new Date(event['Evenement Start datum']);
                                    const endDate = event['Evenement Eind datum'] ? new Date(event['Evenement Eind datum']) : startDate;
                                    const isMultiDay = startDate.toDateString() !== endDate.toDateString();
                                    
                                    return (
                                        <div key={event.id} style={{
                                            background: 'white',
                                            border: '1px solid #e9ecef',
                                            borderRadius: '8px',
                                            padding: window.innerWidth <= 700 ? '16px' : '20px',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                        }}>
                                            <h3 style={{
                                                fontSize: window.innerWidth <= 700 ? '16px' : '18px',
                                                marginBottom: '8px',
                                                color: '#333',
                                                fontWeight: '600'
                                            }}>{event.Evenement}</h3>
                                            <p style={{
                                                fontSize: window.innerWidth <= 700 ? '14px' : '16px',
                                                color: '#666',
                                                marginBottom: '8px'
                                            }}>
                                                {isMultiDay 
                                                    ? `${startDate.toLocaleDateString('nl-NL')} - ${endDate.toLocaleDateString('nl-NL')}`
                                                    : startDate.toLocaleDateString('nl-NL', { 
                                                        weekday: 'long', 
                                                        year: 'numeric', 
                                                        month: 'long', 
                                                        day: 'numeric' 
                                                    })
                                                }
                                            </p>
                                            <button 
                                                onClick={() => handleUnregister(event.id)}
                                                style={{
                                                    padding: window.innerWidth <= 700 ? '8px 16px' : '10px 20px',
                                                    fontSize: window.innerWidth <= 700 ? '14px' : '16px',
                                                    backgroundColor: '#dc3545',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontWeight: '500',
                                                    transition: 'background-color 0.3s ease'
                                                }}
                                                onMouseEnter={(e) => e.target.style.backgroundColor = '#c82333'}
                                                onMouseLeave={(e) => e.target.style.backgroundColor = '#dc3545'}
                                            >
                                                Uitschrijven
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p style={{
                                fontSize: window.innerWidth <= 700 ? '14px' : '16px',
                                color: '#666',
                                textAlign: 'center',
                                padding: '20px',
                                background: '#f8f9fa',
                                borderRadius: '8px',
                                border: '1px solid #e9ecef'
                            }}>
                                Je bent nog niet ingeschreven voor evenementen.
                            </p>
                        )}
                    </div>

                    <div style={{
                        display: 'flex',
                        flexDirection: window.innerWidth <= 700 ? 'column' : 'row',
                        gap: window.innerWidth <= 700 ? '12px' : '16px',
                        marginTop: '24px',
                        padding: window.innerWidth <= 700 ? '16px' : '24px'
                    }}>
                        <button 
                            onClick={() => setIsEditing(true)}
                            style={{
                                padding: window.innerWidth <= 700 ? '14px 20px' : '12px 24px',
                                fontSize: window.innerWidth <= 700 ? '16px' : '16px',
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                transition: 'background-color 0.3s ease',
                                flex: window.innerWidth <= 700 ? 'none' : 1
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#0056b3'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = '#007bff'}
                        >
                            Profiel Bewerken
                        </button>
                        <Link to="/" style={{
                            padding: window.innerWidth <= 700 ? '14px 20px' : '12px 24px',
                            fontSize: window.innerWidth <= 700 ? '16px' : '16px',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            textDecoration: 'none',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            transition: 'background-color 0.3s ease',
                            flex: window.innerWidth <= 700 ? 'none' : 1,
                            textAlign: 'center',
                            display: 'block'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#5a6268'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#6c757d'}
                        >
                            Terug naar Home
                        </Link>
                    </div>
                </>
            )}
            {confirmUnregister && (
                <div className="modal-overlay"><div className="modal" style={{width:'95vw',maxWidth:400}}><p>Weet je zeker dat je je wilt uitschrijven voor het evenement "{registeredEvents.find(event => event.id === confirmUnregister)?.Evenement}"?</p><button onClick={() => handleUnregister(confirmUnregister)}>Ja, uitschrijven</button><button onClick={() => setConfirmUnregister(null)}>Annuleren</button></div></div>
            )}
        </div>
    );
}

export default ProfilePage;
