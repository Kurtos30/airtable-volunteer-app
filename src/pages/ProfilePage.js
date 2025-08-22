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
        <div className="profile-container">
            {isEditing ? (
                <form onSubmit={handleSave} className="profile-form">
                    <h1>Profiel Bewerken</h1>
                    <div className="form-fields">
                        <label>
                            Roepnaam:
                            <input 
                                type="text" 
                                name="Roepnaam" 
                                value={formData.Roepnaam || ''}
                                onChange={handleChange}
                                required
                            />
                        </label>
                        
                        <label>
                            Officiële naam:
                            <input
                                type="text"
                                name="Officiële naam"
                                value={formData['Officiële naam'] || ''}
                                onChange={handleChange}
                            />
                        </label>
                        
                        <label>
                            Pronounce:
                            <input 
                                type="text" 
                                name="Pronounce"
                                value={formData['Pronounce'] || ''}
                                onChange={handleChange}
                                placeholder="Hij/Zij/Hen/etc."
                            />
                        </label>
                        
                        <label>
                            Geboortedatum:
                            <input
                                type="date"
                                name="Geboortedatum"
                                value={formData['Geboortedatum'] || ''}
                                onChange={handleChange}
                            />
                        </label>
                        
                        <label>
                            Email Adres:
                            <input 
                                type="email" 
                                name="Email Adres" 
                                value={formData['Email Adres'] || ''}
                                onChange={handleChange}
                            />
                        </label>
                        
                        <label>
                            Telefoon nummer:
                            <input 
                                type="tel" 
                                name="Telefoon nummer" 
                                value={formData['Telefoon nummer'] || ''}
                                onChange={handleChange}
                            />
                        </label>
                        
                        <label>
                            Adres:
                            <input 
                                type="text" 
                                name="Adres" 
                                value={formData['Adres'] || ''}
                                onChange={handleChange}
                            />
                        </label>
                        
                        <label>
                            Postcode:
                            <input 
                                type="text" 
                                name="Postcode" 
                                value={formData['Postcode'] || ''}
                                onChange={handleChange}
                            />
                        </label>
                        
                        <label>
                            Stad:
                            <input 
                                type="text" 
                                name="Stad" 
                                value={formData['Stad'] || ''}
                                onChange={handleChange}
                            />
                        </label>
                        
                        <label>
                            Contactpersoon indien jonger dan 20:
                            <input
                                type="text"
                                name="Contactpersoon indien jonger dan 20"
                                value={formData['Contactpersoon indien jonger dan 20'] || ''}
                                onChange={handleChange}
                            />
                        </label>
                        
                        <label>
                            Rijbewijs?:
                            <select
                                name="Rijbewijs?"
                                value={formData['Rijbewijs?'] || ''}
                                onChange={handleChange}
                            >
                                <option value="">Selecteer...</option>
                                <option value="Ja">Ja</option>
                                <option value="Nee">Nee</option>
                            </select>
                        </label>
                        
                        <label>
                            Eigen auto?:
                            <select
                                name="Eigen auto?"
                                value={formData['Eigen auto?'] || ''}
                                onChange={handleChange}
                            >
                                <option value="">Selecteer...</option>
                                <option value="Ja">Ja</option>
                                <option value="Nee">Nee</option>
                            </select>
                        </label>
                        
                        <label>
                            Heb jij een eigen, door ons goedgekeurd, kostuum?:
                            <select
                                name="Heb jij een eigen, door ons goedgekeurd, kostuum?"
                                value={formData['Heb jij een eigen, door ons goedgekeurd, kostuum?'] || ''}
                                onChange={handleChange}
                            >
                                <option value="">Selecteer...</option>
                                <option value="Ja">Ja</option>
                                <option value="Nee">Nee</option>
                            </select>
                        </label>
                        
                        <label>
                            Beschikbaarheid:
                            <textarea
                                name="Beschikbaarheid"
                                value={formData['Beschikbaarheid'] || ''}
                                onChange={handleChange}
                                placeholder="Beschrijf je beschikbaarheid..."
                                rows="3"
                            />
                        </label>
                        
                        <label>
                            Zijn er dingen die we moeten weten met betrekking tot eten?:
                            <textarea
                                name="Zijn er dingen die we moeten weten met betrekking tot eten?"
                                value={formData['Zijn er dingen die we moeten weten met betrekking tot eten?'] || ''}
                                onChange={handleChange}
                                placeholder="Allergieën, voorkeuren, etc."
                                rows="3"
                            />
                        </label>
                        
                        <label>
                            Opsomming allergiën:
                            <textarea
                                name="Opsomming allergiën"
                                value={formData['Opsomming allergiën'] || ''}
                                onChange={handleChange}
                                placeholder="Lijst van allergieën..."
                                rows="3"
                            />
                        </label>
                        
                        <label>
                            Belangrijk om te weten:
                            <textarea
                                name="Belangrijk om te weten"
                                value={formData['Belangrijk om te weten'] || ''}
                                onChange={handleChange}
                                placeholder="Andere belangrijke informatie..."
                                rows="3"
                            />
                        </label>
                    </div>
                    
                    <div className="profile-buttons">
                        <button type="submit" disabled={loading}>
                            {loading ? 'Opslaan...' : 'Opslaan'}
                        </button>
                        <button type="button" onClick={() => setIsEditing(false)}>
                            Annuleren
                        </button>
                    </div>
                    
                    {error && <div className="error">{error}</div>}
                </form>
            ) : (
                <div className="profile-view">
                    <h1>Mijn Profiel</h1>
                    
                    {/* Profile Photo */}
                    <div className="profile-photo-section">
                        {user['Photo'] && user['Photo'][0] ? (
                            <img 
                                src={user['Photo'][0].url} 
                                alt="Profiel foto" 
                                className="profile-photo"
                            />
                        ) : (
                            <div className="profile-photo-placeholder">
                                📷 Geen foto
                                </div>
                            )}

                        <div className="photo-upload">
                            <label className="upload-button">
                                {uploadingPhoto ? 'Uploaden...' : 'Foto uploaden'}
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={handlePhotoUpload} 
                                    style={{ display: 'none' }}
                                    disabled={uploadingPhoto}
                                />
                            </label>
                        </div>
                    </div>

                    {/* Profile Details */}
                    <div className="profile-details">
                        <p><strong>Naam:</strong> {renderField(user.Naam)}</p>
                        <p><strong>Roepnaam:</strong> {renderField(user.Roepnaam)}</p>
                        <p><strong>Officiële naam:</strong> {renderField(user['Officiële naam'])}</p>
                        <p><strong>Pronounce:</strong> {renderField(user['Pronounce'])}</p>
                        <p><strong>Geboortedatum:</strong> {renderField(user['Geboortedatum'])}</p>
                        <p><strong>Email:</strong> {renderField(user['Email Adres'])}</p>
                        <p><strong>Telefoon:</strong> {renderField(user['Telefoon nummer'])}</p>
                        <p><strong>Adres:</strong> {renderField(user.Adres)}</p>
                        <p><strong>Postcode:</strong> {renderField(user.Postcode)}</p>
                        <p><strong>Stad:</strong> {renderField(user.Stad)}</p>
                        <p><strong>Contactpersoon indien jonger dan 20:</strong> {renderField(user['Contactpersoon indien jonger dan 20'])}</p>
                        <p><strong>Rijbewijs:</strong> {renderField(user['Rijbewijs?'])}</p>
                        <p><strong>Eigen auto:</strong> {renderField(user['Eigen auto?'])}</p>
                        <p><strong>Eigen kostuum:</strong> {renderField(user['Heb jij een eigen, door ons goedgekeurd, kostuum?'])}</p>
                        <p><strong>Beschikbaarheid:</strong> {renderField(user['Beschikbaarheid'])}</p>
                        <p><strong>Eetwensen:</strong> {renderField(user['Zijn er dingen die we moeten weten met betrekking tot eten?'])}</p>
                        <p><strong>Allergieën:</strong> {renderField(user['Opsomming allergiën'])}</p>
                        <p><strong>Belangrijk om te weten:</strong> {renderField(user['Belangrijk om te weten'])}</p>
                    </div>
                    
                    {/* Theme Selector */}
                    <div className="theme-selector">
                        <label>
                            Thema:
                            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                            <option value="light">Licht</option>
                            <option value="dark">Donker</option>
                            <option value="christmas">Kerst</option>
                            <option value="summer">Zomer</option>
                        </select>
                        </label>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="profile-buttons">
                        <button onClick={() => setIsEditing(true)}>
                            Profiel Bewerken
                        </button>
                        <Link to="/" className="nav-button-secondary">
                            Terug naar Home
                        </Link>
                    </div>

                    {/* Registered Events */}
                    <div className="registered-events">
                        <h2>Mijn Inschrijvingen</h2>
                        {eventsLoading ? (
                            <p>Laden...</p>
                        ) : registeredEvents.length > 0 ? (
                            <ul>
                                {registeredEvents.map(event => (
                                    <li key={event.id}>
                                        <strong>{event.Evenement || event.Event || event.Naam || 'Onbekend evenement'}</strong>
                                        <br />
                                        <small>
                                            {event['Evenement Start datum'] || event['Start datum'] || event['Start Date'] || event['Start'] || 'Geen datum'}
                                        </small>
                                            <button 
                                                onClick={() => handleUnregister(event.id)}
                                            className="unregister-button"
                                            >
                                                Uitschrijven
                                            </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p>Je bent nog niet ingeschreven voor evenementen.</p>
                        )}
                    </div>
                    </div>
            )}
            {confirmUnregister && (
                <div className="modal-overlay"><div className="modal" style={{width:'95vw',maxWidth:400}}><p>Weet je zeker dat je je wilt uitschrijven voor het evenement "{registeredEvents.find(event => event.id === confirmUnregister)?.Evenement}"?</p><button onClick={() => handleUnregister(confirmUnregister)}>Ja, uitschrijven</button><button onClick={() => setConfirmUnregister(null)}>Annuleren</button></div></div>
            )}
        </div>
    );
}

export default ProfilePage;
