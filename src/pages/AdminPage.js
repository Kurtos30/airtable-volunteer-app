import React, { useEffect, useState } from 'react';
import Airtable from 'airtable';
import { Link } from 'react-router-dom';

const base = new Airtable({
    apiKey: process.env.REACT_APP_AIRTABLE_API_KEY
}).base(process.env.REACT_APP_AIRTABLE_BASE_ID);

function AdminPage() {
    const [registrations, setRegistrations] = useState([]);
    const [filteredRegistrations, setFilteredRegistrations] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filter registrations based on search term
    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredRegistrations(registrations);
        } else {
            const filtered = registrations.filter(reg => 
                reg.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                reg.nickname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                reg.email?.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredRegistrations(filtered);
        }
    }, [searchTerm, registrations]);

    useEffect(() => {
        const fetchRegistrations = async () => {
            setLoading(true);
            setError(null);
            try {
                // Haal alle vrijwilligers op (niet alleen die met inschrijvingen)
                const volunteerRecords = await base(process.env.REACT_APP_AIRTABLE_VOLUNTEERS_TABLE_NAME).select({
                    fields: [
                        'Roepnaam',
                        'Naam', 
                        'Email Adres',
                        'Telefoon nummer',
                        'Adres',
                        'Postcode',
                        'Stad',
                        'Opgegeven Evenementen',
                    ]
                }).all();
                console.log('Airtable volunteerRecords:', volunteerRecords);
                if (volunteerRecords.length > 0) {
                  console.log('Eerste volunteerRecord fields:', volunteerRecords[0].fields);
                }

                // Haal alle events op
                const eventRecords = await base(process.env.REACT_APP_AIRTABLE_TABLE_NAME).select({
                    fields: ['Evenement', 'Evenement Start datum']
                }).all();
                const eventMap = Object.fromEntries(eventRecords.map(ev => [ev.id, ev.fields]));
                console.log('eventMap:', eventMap);

                // Combineer vrijwilliger + evenementen info
                const data = volunteerRecords.map(rec => {
                    // Gebruik de juiste veldnamen voor evenementen
                    const registrations = rec.get('Opgegeven Evenementen') || [];
                    console.log('Volunteer', rec.id, 'registrations:', registrations);
                    
                    // Debug: toon ook de naam van de vrijwilliger
                    const volunteerName = rec.get('Naam');
                    console.log('Processing volunteer:', volunteerName, 'with registrations:', registrations);
                    
                    const events = registrations.length > 0
                        ? registrations.map(registration => {
                            // All registrations are now just event IDs
                            const eventId = registration;
                            
                            if (!eventMap[eventId]) {
                              console.warn('Event-ID niet gevonden in eventMap:', eventId, 'for volunteer:', volunteerName);
                            }
                            const event = eventMap[eventId];
                            
                            if (event) {
                                const eventName = `${event.Evenement} (${event['Evenement Start datum'] ? new Date(event['Evenement Start datum']).toLocaleDateString('nl-NL') : ''})`;
                                return eventName;
                            } else {
                                return `Event-ID: ${eventId}`;
                            }
                        })
                        : ['Geen inschrijvingen'];
                    
                    console.log('Final events for', volunteerName, ':', events);
                    
                    return {
                        id: rec.id,
                        name: rec.get('Naam'),
                        nickname: rec.get('Roepnaam'),
                        email: rec.get('Email Adres'),
                        phone: rec.get('Telefoon nummer'),
                        address: rec.get('Adres'),
                        postcode: rec.get('Postcode'),
                        city: rec.get('Stad'),
                        events,
                        registrations, // Voeg registrations toe voor debugging
                    };
                });
                console.log('eventMap keys:', Object.keys(eventMap));
                console.log('Processed data:', data);
                setRegistrations(data);
            } catch (err) {
                setError('Fout bij het ophalen van de inschrijvingen.');
                console.error(err);
            }
            setLoading(false);
        };
        fetchRegistrations();
    }, []);

    return (
        <div>
            <h1>Admin Dashboard</h1>
            <p>Welkom, Admin! Hier kunt u evenementen en gebruikers beheren.</p>
            
            {/* Admin Navigation */}
            <div style={{marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 12}}>
                <Link to="/admin/events" className="nav-button">📋 Bekijk alle evenementen & inschrijvingen</Link>
                <Link to="/admin/add-event" className="nav-button">➕ Nieuw evenement toevoegen</Link>
                <Link to="/kalender" className="nav-button">📅 Evenementen kalender</Link>
                <Link to="/admin/rooster" className="nav-button">🗂️ Team rooster beheren</Link>
            </div>
            
            <h2>Alle Inschrijvingen</h2>
            
            {/* Search functionality */}
            <div style={{marginBottom: 20}}>
                <input
                    type="text"
                    placeholder="Zoek op naam, roepnaam of email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        padding: '10px 15px',
                        fontSize: '16px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        width: '300px',
                        marginRight: '10px'
                    }}
                />
                {searchTerm && (
                    <span style={{color: '#666', fontSize: '14px'}}>
                        {filteredRegistrations.length} van {registrations.length} resultaten
                    </span>
                )}
            </div>

            {loading ? (
                <p>Inschrijvingen laden...</p>
            ) : error ? (
                <p className="error">{error}</p>
            ) : (
                <div style={{overflowX: 'auto'}}>
                    <table style={{minWidth: 900}}>
                        <thead>
                            <tr>
                                <th>Roepnaam</th>
                                <th>Volledige Naam</th>
                                <th>Email</th>
                                <th>Telefoon</th>
                                <th>Adres</th>
                                <th>Postcode</th>
                                <th>Stad</th>
                                <th>Ingeschreven voor</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRegistrations.map(v => (
                                <tr key={v.id}>
                                    <td>{v.nickname}</td>
                                    <td>{v.name}</td>
                                    <td>{v.email}</td>
                                    <td>{v.phone}</td>
                                    <td>{v.address}</td>
                                    <td>{v.postcode}</td>
                                    <td>{v.city}</td>
                                    <td>
                                        {/* Toon events in leesbaar formaat */}
                                        {v.events.length > 0 ? (
                                            <ul style={{margin: 0, padding: 0, listStyle: 'none'}}>
                                                {v.events.map((event, index) => (
                                                    <li key={index} style={{marginBottom: '4px'}}>
                                                        {event}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <span style={{color: '#999'}}>Geen inschrijvingen</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default AdminPage; 