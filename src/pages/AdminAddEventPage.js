import React, { useState, useEffect } from 'react';
import Airtable from 'airtable';
import { Link, useNavigate } from 'react-router-dom';

const base = new Airtable({
    apiKey: process.env.REACT_APP_AIRTABLE_API_KEY
}).base(process.env.REACT_APP_AIRTABLE_BASE_ID);

function AdminAddEventPage() {
    const [eventName, setEventName] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // Check table structure on component mount
    useEffect(() => {
        const checkTableStructure = async () => {
            try {
                console.log('Checking table structure...');
                const sampleRecord = await base(process.env.REACT_APP_AIRTABLE_TABLE_NAME).select({ maxRecords: 1 }).firstPage();
                if (sampleRecord.length > 0) {
                    const fields = Object.keys(sampleRecord[0].fields);
                    console.log('Available fields in table:', fields);
                } else {
                    console.log('No existing records in table');
                }
            } catch (err) {
                console.error('Error checking table structure:', err);
            }
        };
        checkTableStructure();
    }, []);

    const checkTableStructure = async () => {
        try {
            setLoading(true);
            console.log('Manually checking table structure...');
            const sampleRecord = await base(process.env.REACT_APP_AIRTABLE_TABLE_NAME).select({ maxRecords: 1 }).firstPage();
            if (sampleRecord.length > 0) {
                const fields = Object.keys(sampleRecord[0].fields);
                console.log('Available fields in table:', fields);
                setMessage(`Tabel structuur geladen. ${fields.length} velden gevonden.`);
            } else {
                console.log('No existing records in table');
                setMessage('Geen bestaande records in tabel gevonden.');
            }
        } catch (err) {
            console.error('Error checking table structure:', err);
            setError(`Fout bij het controleren van tabel structuur: ${err.message}`);
        }
        setLoading(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!eventName.trim() || !startDate || !endDate) {
            setError('Vul alle verplichte velden in.');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            setError('Einddatum moet na startdatum liggen.');
            return;
        }

        setLoading(true);
        setError('');
        setMessage('');

        // Try multiple field name combinations
        const fieldCombinations = [
            // First attempt - exact field names that calendar expects
            {
                'Evenement': eventName,
                'A Start datum': startDate,
                'A Eind datum': endDate,
                'Beschrijving': description || '',
                'Locatie': location || '',
                'Aangemaakt op': new Date().toISOString().split('T')[0]
            },
            // Second attempt - alternative date field names
            {
                'Evenement': eventName,
                'Evenement Start datum': startDate,
                'Evenement Eind datum': endDate,
                'Beschrijving': description || '',
                'Locatie': location || ''
            },
            // Third attempt - shorter field names
            {
                'Evenement': eventName,
                'Start datum': startDate,
                'Eind datum': endDate,
                'Beschrijving': description || '',
                'Locatie': location || ''
            },
            // Fourth attempt - English field names
            {
                'Evenement': eventName,
                'Start Date': startDate,
                'End Date': endDate,
                'Description': description || '',
                'Location': location || ''
            },
            // Fifth attempt - minimal fields (just event name and dates)
            {
                'Evenement': eventName,
                'A Start datum': startDate,
                'A Eind datum': endDate
            }
        ];

        for (let i = 0; i < fieldCombinations.length; i++) {
            try {
                console.log(`Attempt ${i + 1}: Trying field combination:`, fieldCombinations[i]);
                
                const newEvent = await base(process.env.REACT_APP_AIRTABLE_TABLE_NAME).create([
                    {
                        fields: fieldCombinations[i]
                    }
                ]);

                console.log('Event created successfully:', newEvent);
                setMessage('Evenement succesvol toegevoegd!');
                setTimeout(() => {
                    navigate('/admin/events');
                }, 2000);
                setLoading(false);
                return;

            } catch (err) {
                console.error(`Attempt ${i + 1} failed:`, err);
                
                // If this is the last attempt, show the error
                if (i === fieldCombinations.length - 1) {
                    console.error('All field combinations failed');
                    setError(`Fout bij het toevoegen van het evenement. Controleer de veldnamen in je Airtable tabel. Laatste fout: ${err.message}`);
                }
                // Otherwise, continue to the next attempt
            }
        }

        setLoading(false);
    };

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
            <div style={{ marginBottom: '20px' }}>
                <Link to="/admin" className="nav-button" style={{ marginRight: '10px' }}>
                    ← Terug naar Admin Dashboard
                </Link>
                <Link to="/admin/events" className="nav-button">
                    📋 Bekijk alle evenementen
                </Link>
            </div>

            <h1>Nieuw Evenement Toevoegen</h1>
            
            {/* Debug info for field names */}
            <div style={{ 
                background: '#e3f2fd', 
                padding: '15px', 
                borderRadius: '4px', 
                marginBottom: '15px',
                fontSize: '12px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <strong>Debug: Tabel Structuur</strong>
                    <button
                        type="button"
                        onClick={checkTableStructure}
                        disabled={loading}
                        style={{
                            padding: '5px 10px',
                            fontSize: '11px',
                            background: '#2196f3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.6 : 1
                        }}
                    >
                        {loading ? 'Controleren...' : 'Ververs Velden'}
                    </button>
                </div>
                
                {/* tableFields.length > 0 ? ( */}
                    <div>
                        <div style={{ marginBottom: '5px' }}>
                            <strong>Beschikbare velden in tabel (0):</strong>
                        </div>
                        <div style={{ marginTop: '5px' }}>
                            <span style={{ 
                                display: 'inline-block', 
                                background: '#fff', 
                                padding: '2px 6px', 
                                margin: '2px', 
                                borderRadius: '3px',
                                border: '1px solid #ccc'
                            }}>
                                "Evenement"
                            </span>
                            <span style={{ 
                                display: 'inline-block', 
                                background: '#fff', 
                                padding: '2px 6px', 
                                margin: '2px', 
                                borderRadius: '3px',
                                border: '1px solid #ccc'
                            }}>
                                "A Start datum"
                            </span>
                            <span style={{ 
                                display: 'inline-block', 
                                background: '#fff', 
                                padding: '2px 6px', 
                                margin: '2px', 
                                borderRadius: '3px',
                                border: '1px solid #ccc'
                            }}>
                                "A Eind datum"
                            </span>
                            <span style={{ 
                                display: 'inline-block', 
                                background: '#fff', 
                                padding: '2px 6px', 
                                margin: '2px', 
                                borderRadius: '3px',
                                border: '1px solid #ccc'
                            }}>
                                "Beschrijving"
                            </span>
                            <span style={{ 
                                display: 'inline-block', 
                                background: '#fff', 
                                padding: '2px 6px', 
                                margin: '2px', 
                                borderRadius: '3px',
                                border: '1px solid #ccc'
                            }}>
                                "Locatie"
                            </span>
                            <span style={{ 
                                display: 'inline-block', 
                                background: '#fff', 
                                padding: '2px 6px', 
                                margin: '2px', 
                                borderRadius: '3px',
                                border: '1px solid #ccc'
                            }}>
                                "Aangemaakt op"
                            </span>
                        </div>
                    </div>
                {/* ) : ( */}
                    <div style={{ color: '#666' }}>
                        Klik op "Ververs Velden" om de beschikbare velden te laden.
                    </div>
                {/* )} */}
            </div>
            
            <form onSubmit={handleSubmit} style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px' }}>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                        Evenement naam *
                    </label>
                    <input
                        type="text"
                        value={eventName}
                        onChange={(e) => setEventName(e.target.value)}
                        placeholder="Bijv. Zomerfestival 2025"
                        style={{
                            width: '100%',
                            padding: '10px',
                            fontSize: '16px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                        }}
                        required
                    />
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                        Startdatum *
                    </label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px',
                            fontSize: '16px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                        }}
                        required
                    />
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                        Einddatum *
                    </label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px',
                            fontSize: '16px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                        }}
                        required
                    />
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                        Locatie
                    </label>
                    <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Bijv. Stadspark, Hoofdstraat 123"
                        style={{
                            width: '100%',
                            padding: '10px',
                            fontSize: '16px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                        }}
                    />
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                        Beschrijving
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Beschrijf het evenement..."
                        rows="4"
                        style={{
                            width: '100%',
                            padding: '10px',
                            fontSize: '16px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            resize: 'vertical'
                        }}
                    />
                </div>

                {error && (
                    <div style={{ 
                        color: '#d32f2f', 
                        background: '#ffebee', 
                        padding: '10px', 
                        borderRadius: '4px', 
                        marginBottom: '15px' 
                    }}>
                        {error}
                    </div>
                )}

                {message && (
                    <div style={{ 
                        color: '#2e7d32', 
                        background: '#e8f5e8', 
                        padding: '10px', 
                        borderRadius: '4px', 
                        marginBottom: '15px' 
                    }}>
                        {message}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            padding: '12px 24px',
                            fontSize: '16px',
                            background: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.6 : 1
                        }}
                    >
                        {loading ? 'Toevoegen...' : 'Evenement Toevoegen'}
                    </button>
                    
                    <button
                        type="button"
                        onClick={() => navigate('/admin/events')}
                        style={{
                            padding: '12px 24px',
                            fontSize: '16px',
                            background: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Annuleren
                    </button>
                </div>
            </form>
        </div>
    );
}

export default AdminAddEventPage; 