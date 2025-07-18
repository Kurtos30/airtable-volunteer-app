import React, { useEffect, useState } from 'react';
import Airtable from 'airtable';
import { Link } from 'react-router-dom'; // Added Link import

const base = new Airtable({
    apiKey: process.env.REACT_APP_AIRTABLE_API_KEY
}).base(process.env.REACT_APP_AIRTABLE_BASE_ID);

function VolunteerModal({ volunteer, onClose }) {
    if (!volunteer) return null;
    return (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{background:'#fff',padding:32,borderRadius:8,minWidth:320,maxWidth:500,boxShadow:'0 4px 16px rgba(0,0,0,0.2)',position:'relative',maxHeight:'90vh',overflowY:'auto'}}>
                <button onClick={onClose} style={{position:'absolute',top:8,right:12,fontSize:20,background:'none',border:'none',cursor:'pointer'}}>&times;</button>
                <h2>{volunteer.nickname || volunteer.name}</h2>
                <ul style={{listStyle:'none',padding:0}}>
                    <li><strong>Volledige Naam:</strong> {volunteer.name}</li>
                    <li><strong>Roepnaam:</strong> {volunteer.nickname}</li>
                    <li><strong>Email:</strong> {volunteer.email}</li>
                    <li><strong>Telefoon:</strong> {volunteer.phone}</li>
                    <li><strong>Adres:</strong> {volunteer.address}</li>
                    <li><strong>Postcode:</strong> {volunteer.postcode}</li>
                    <li><strong>Stad:</strong> {volunteer.city}</li>
                </ul>
            </div>
        </div>
    );
}

function AdminEventsPage() {
    const [events, setEvents] = useState([]);
    const [volunteers, setVolunteers] = useState({});
    const [filteredEvents, setFilteredEvents] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedVolunteer, setSelectedVolunteer] = useState(null);

    // Filter events based on search term
    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredEvents(events);
        } else {
            const filtered = events.filter(event => 
                event.name?.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredEvents(filtered);
        }
    }, [searchTerm, events]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                // Haal alle evenementen op
                const eventRecords = await base(process.env.REACT_APP_AIRTABLE_TABLE_NAME).select({
                    fields: ['Evenement', 'Evenement Start datum']
                }).all();
                const eventsList = eventRecords.map(ev => ({
                    id: ev.id,
                    name: ev.get('Evenement'),
                    date: ev.get('Evenement Start datum'),
                }));

                // Haal alle vrijwilligers op met inschrijvingen
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

                // Maak een map van eventId -> array van vrijwilligers
                const eventToVolunteers = {};
                for (const v of volunteerRecords) {
                    const registrations = v.get('Opgegeven Evenementen') || [];
                    for (const registration of registrations) {
                        // All registrations are now just event IDs
                        const eventId = registration;
                        
                        if (!eventToVolunteers[eventId]) eventToVolunteers[eventId] = [];
                        
                        const volunteerInfo = {
                            id: v.id,
                            name: v.get('Naam'),
                            nickname: v.get('Roepnaam'),
                            email: v.get('Email Adres'),
                            phone: v.get('Telefoon nummer'),
                            address: v.get('Adres'),
                            postcode: v.get('Postcode'),
                            city: v.get('Stad'),
                        };
                        
                        eventToVolunteers[eventId].push(volunteerInfo);
                    }
                }

                setEvents(eventsList);
                setVolunteers(eventToVolunteers);
            } catch (err) {
                setError('Fout bij het ophalen van de evenementen of inschrijvingen.');
                console.error(err);
            }
            setLoading(false);
        };
        fetchData();
    }, []);

    return (
        <div>
            <div style={{ marginBottom: '20px' }}>
                <Link to="/admin" className="nav-button" style={{ marginRight: '10px' }}>
                    ← Terug naar Admin Dashboard
                </Link>
                <Link to="/admin/add-event" className="nav-button">
                    ➕ Nieuw evenement toevoegen
                </Link>
                <Link to="/kalender" className="nav-button">
                    📅 Bekijk kalender
                </Link>
            </div>
            
            <h1>Alle Evenementen & Inschrijvingen</h1>
            
            {/* Search functionality */}
            <div style={{marginBottom: 20}}>
                <input
                    type="text"
                    placeholder="Zoek op evenementnaam..."
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
                        {filteredEvents.length} van {events.length} evenementen gevonden
                    </span>
                )}
            </div>

            {loading ? (
                <p>Laden...</p>
            ) : error ? (
                <p className="error">{error}</p>
            ) : (
                <div>
                    {filteredEvents.map(event => (
                        <div key={event.id} style={{marginBottom: 40, borderBottom: '1px solid #ccc', paddingBottom: 20}}>
                            <h2>{event.name} <span style={{fontWeight: 'normal', color: '#666'}}>{event.date ? new Date(event.date).toLocaleDateString('nl-NL') : ''}</span></h2>
                            <h4>Inschrijvingen:</h4>
                            {volunteers[event.id] && volunteers[event.id].length > 0 ? (
                                <table style={{minWidth: 800}}>
                                    <thead>
                                        <tr>
                                            <th>Roepnaam</th>
                                            <th>Volledige Naam</th>
                                            <th>Email</th>
                                            <th>Telefoon</th>
                                            <th>Adres</th>
                                            <th>Postcode</th>
                                            <th>Stad</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {volunteers[event.id].map(v => (
                                            <tr key={v.id}>
                                                <td>
                                                    <button style={{background:'none',border:'none',color:'#007bff',textDecoration:'underline',cursor:'pointer',padding:0}} onClick={() => setSelectedVolunteer(v)}>{v.nickname}</button>
                                                </td>
                                                <td>{v.name}</td>
                                                <td>{v.email}</td>
                                                <td>{v.phone}</td>
                                                <td>{v.address}</td>
                                                <td>{v.postcode}</td>
                                                <td>{v.city}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p>Geen inschrijvingen voor dit evenement.</p>
                            )}
                            <Link to={`/admin/rooster?eventId=${event.id}`} className="nav-button" style={{marginTop: 10, display: 'inline-block'}}>
                                Maak rooster voor dit evenement
                            </Link>
                        </div>
                    ))}
                    {searchTerm && filteredEvents.length === 0 && (
                        <p>Geen evenementen gevonden met "{searchTerm}".</p>
                    )}
                </div>
            )}
            <VolunteerModal volunteer={selectedVolunteer} onClose={() => setSelectedVolunteer(null)} />
        </div>
    );
}

export default AdminEventsPage; 