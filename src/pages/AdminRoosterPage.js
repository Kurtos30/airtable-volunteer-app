import React, { useEffect, useState } from 'react';
import Airtable from 'airtable';
import { useLocation } from 'react-router-dom';

const base = new Airtable({
    apiKey: process.env.REACT_APP_AIRTABLE_API_KEY
}).base(process.env.REACT_APP_AIRTABLE_BASE_ID);

export default function AdminRoosterPage({ user }) {
    // All useState hooks at the top
    const [events, setEvents] = useState([]);
    const [selectedEvent, setSelectedEvent] = useState('');
    const [date, setDate] = useState('');
    const [afdeling, setAfdeling] = useState('Kassa');
    const [startTime, setStartTime] = useState('07:00');
    const [endTime, setEndTime] = useState('08:00');
    const [volunteers, setVolunteers] = useState([]);
    const [selectedVolunteer, setSelectedVolunteer] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [roosterRecords, setRoosterRecords] = useState([]);
    const [roosterLoading, setRoosterLoading] = useState(true);
    const location = useLocation();
    const [filterEvent, setFilterEvent] = useState('');
    const [selectedRoosterDate, setSelectedRoosterDate] = useState('');
    const [departments, setDepartments] = useState([]);
    const [newDepartment, setNewDepartment] = useState('');
    const [editingDepartmentId, setEditingDepartmentId] = useState(null);
    const [editingDepartmentName, setEditingDepartmentName] = useState('');
    const [adminTab, setAdminTab] = useState('beheer'); // 'beheer' of 'bekijken'
    // Move these up from below
    const [editBlocks, setEditBlocks] = useState([]);
    const [selectedBlocksToDelete, setSelectedBlocksToDelete] = useState([]);
    
    // Haal alle evenementen op
    useEffect(() => {
        async function fetchEvents() {
            try {
                const records = await base(process.env.REACT_APP_AIRTABLE_TABLE_NAME).select({
                    fields: ['Evenement', 'Evenement Start datum', 'Evenement Eind datum']
                }).all();
                setEvents(records.map(rec => ({
                    id: rec.id,
                    name: rec.get('Evenement'),
                    start: rec.get('Evenement Start datum'),
                    end: rec.get('Evenement Eind datum')
                })));
            } catch (err) {
                setError('Fout bij ophalen evenementen.');
            }
        }
        fetchEvents();
        // Check for eventId in query params
        const params = new URLSearchParams(location.search);
        const eventId = params.get('eventId');
        if (eventId) {
            setSelectedEvent(eventId);
        }
    }, [location.search]);

    // Haal vrijwilligers op die zich hebben opgegeven voor het geselecteerde evenement
    useEffect(() => {
        async function fetchVolunteers() {
            setVolunteers([]);
            setSelectedVolunteer('');
            if (!selectedEvent) return;
            try {
                const volunteerRecords = await base(process.env.REACT_APP_AIRTABLE_VOLUNTEERS_TABLE_NAME).select({
                    fields: ['Roepnaam', 'Naam', 'Opgegeven Evenementen'],
                }).all();
                const filtered = volunteerRecords.filter(rec => {
                    const events = rec.get('Opgegeven Evenementen') || [];
                    return events.includes(selectedEvent);
                });
                setVolunteers(filtered.map(rec => ({
                    id: rec.id,
                    name: rec.get('Naam'),
                    nickname: rec.get('Roepnaam')
                })));
            } catch (err) {
                setError('Fout bij ophalen vrijwilligers.');
            }
        }
        fetchVolunteers();
    }, [selectedEvent]);

    // Haal rooster records op
    const fetchRooster = async () => {
        setRoosterLoading(true);
        try {
            // First, let's check what fields are available in the Team Roosters table
            console.log('Checking Team Roosters table structure...');
            const sampleRecord = await base('Team Roosters').select({ maxRecords: 1 }).firstPage();
            if (sampleRecord.length > 0) {
                console.log('Sample Team Roosters record fields:', Object.keys(sampleRecord[0].fields));
                console.log('Sample Team Roosters record:', sampleRecord[0].fields);
            } else {
                console.log('No existing records in Team Roosters table');
            }
            
            const records = await base('Team Roosters').select({
                fields: ['Event Name', 'Start tijd', 'Eind tijd', 'Afdeling', 'Volunteer Name'],
                sort: [ {field: 'Start tijd', direction: 'asc'} ]
            }).all();
            // Haal alle benodigde event/vrijwilliger namen op
            const eventIds = Array.from(new Set(records.flatMap(r => r.get('Event Name') || [])));
            const volunteerIds = Array.from(new Set(records.flatMap(r => r.get('Volunteer Name') || [])));
            let eventMap = {};
            let volunteerMap = {};
            if (eventIds.length > 0) {
                const eventRecs = await base(process.env.REACT_APP_AIRTABLE_TABLE_NAME).select({
                    filterByFormula: `OR(${eventIds.map(id => `RECORD_ID() = '${id}'`).join(',')})`,
                    fields: ['Evenement']
                }).all();
                eventMap = Object.fromEntries(eventRecs.map(ev => [ev.id, ev.get('Evenement')]));
            }
            if (volunteerIds.length > 0) {
                const volunteerRecs = await base(process.env.REACT_APP_AIRTABLE_VOLUNTEERS_TABLE_NAME).select({
                    filterByFormula: `OR(${volunteerIds.map(id => `RECORD_ID() = '${id}'`).join(',')})`,
                    fields: ['Roepnaam', 'Naam']
                }).all();
                volunteerMap = Object.fromEntries(volunteerRecs.map(v => [v.id, v.get('Roepnaam') || v.get('Naam')]));
            }
            setRoosterRecords(records.map(rec => {
                const eventId = (rec.get('Event Name') || [])[0];
                const volunteerId = (rec.get('Volunteer Name') || [])[0];
                return {
                    id: rec.id,
                    event: eventMap[eventId] || eventId || '',
                    date: rec.get('Start tijd') ? rec.get('Start tijd').split('T')[0] : '',
                    afdeling: (rec.get('Afdeling') || []).join(', '),
                    volunteer: volunteerMap[volunteerId] || '',
                    start: rec.get('Start tijd'),
                    end: rec.get('Eind tijd')
                };
            }));
        } catch (err) {
            setError('Fout bij ophalen rooster.');
        }
        setRoosterLoading(false);
    };

    useEffect(() => {
        fetchRooster();
    }, []);

    const handleCreateRooster = async () => {
        setLoading(true);
        setMessage('');
        setError('');
        try {
            if (!selectedEvent || !date || !afdeling || !startTime || !endTime || !selectedVolunteer) {
                setError('Vul alle velden in.');
                setLoading(false);
                return;
            }
            // Debug: Log the data being sent
            console.log('Creating rooster with data:', {
                selectedEvent,
                date,
                afdeling,
                startTime,
                endTime,
                selectedVolunteer
            });
            // Combineer datum en tijd tot ISO string
            const startIso = new Date(`${date}T${startTime}:00.000Z`).toISOString();
            const endIso = new Date(`${date}T${endTime}:00.000Z`).toISOString();
            console.log('ISO timestamps:', { startIso, endIso });
            // Try different field name variations
            const recordData = {
                    fields: {
                        'Event Name': [selectedEvent],
                        'Volunteer Name': [selectedVolunteer],
                        'Start tijd': startIso,
                        'Eind tijd': endIso,
                        'Afdeling': [afdeling],
                        'Notites': 'Handmatig rooster aangemaakt'
                    }
            };
            console.log('Sending to Airtable:', recordData);
            const result = await base('Team Roosters').create([recordData]);
            console.log('Airtable response:', result);
            setMessage('Rooster succesvol aangemaakt!');
            // Refresh the rooster data without reloading the page
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (err) {
            console.error('Error creating rooster:', err);
            console.error('Error details:', {
                message: err.message,
                status: err.status,
                error: err.error,
                response: err.response
            });
            // Try alternative field names if the first attempt fails
            if (err.status === 422) {
                console.log('Trying alternative field names...');
                try {
                    // Recreate the timestamps in the catch block scope
                    const altStartIso = new Date(`${date}T${startTime}:00.000Z`).toISOString();
                    const altEndIso = new Date(`${date}T${endTime}:00.000Z`).toISOString();
                    const alternativeRecordData = {
                        fields: {
                            'Event': [selectedEvent],
                            'Volunteer': [selectedVolunteer],
                            'Start': altStartIso,
                            'End': altEndIso,
                            'Department': [afdeling],
                            'Notes': 'Handmatig rooster aangemaakt'
                        }
                    };
                    console.log('Trying alternative data:', alternativeRecordData);
                    const altResult = await base('Team Roosters').create([alternativeRecordData]);
                    console.log('Alternative Airtable response:', altResult);
                    setMessage('Rooster succesvol aangemaakt! (met alternatieve veldnamen)');
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                } catch (altErr) {
                    console.error('Alternative approach also failed:', altErr);
                    setError(`Fout bij aanmaken rooster: ${err.message || 'Onbekende fout'}. Controleer de console voor details.`);
                }
            } else {
                setError(`Fout bij aanmaken rooster: ${err.message || 'Onbekende fout'}`);
            }
        }
        setLoading(false);
    };

    // Fetch departments from Airtable
    useEffect(() => {
        async function fetchDepartments() {
            try {
                const records = await base('Afdelingen').select({fields: ['Naam'], sort: [{field: 'Naam', direction: 'asc'}]}).all();
                setDepartments(records.map(rec => ({ id: rec.id, name: rec.get('Naam') })));
            } catch (err) {
                console.error('Error fetching departments:', err);
                // Fallback to default departments if table doesn't exist
                const defaultDepartments = [
                    { id: 'default-1', name: 'Kassa' },
                    { id: 'default-2', name: 'Bar' },
                    { id: 'default-3', name: 'Keuken' },
                    { id: 'default-4', name: 'Bediening' },
                    { id: 'default-5', name: 'Organisatie' }
                ];
                setDepartments(defaultDepartments);
                setError('Afdelingen tabel niet gevonden. Gebruik standaard afdelingen.');
            }
        }
        fetchDepartments();
    }, []);

    // Add department
    const handleAddDepartment = async () => {
        if (!newDepartment.trim()) return;
        try {
            // Check if we're using fallback departments (no real Airtable table)
            const isUsingFallback = departments.some(dep => dep.id.startsWith('default-'));
            
            if (isUsingFallback) {
                // Add to local state only
                const newId = `default-${Date.now()}`;
                setDepartments([...departments, { id: newId, name: newDepartment }]);
                setNewDepartment('');
                setMessage('Afdeling toegevoegd (lokaal - geen Airtable tabel)');
            } else {
                // Add to Airtable
            const rec = await base('Afdelingen').create([{ fields: { Naam: newDepartment } }]);
            setDepartments([...departments, { id: rec[0].id, name: newDepartment }]);
            setNewDepartment('');
                setMessage('Afdeling succesvol toegevoegd!');
            }
        } catch (err) {
            console.error('Error adding department:', err);
            setError(`Fout bij toevoegen afdeling: ${err.message || 'Onbekende fout'}`);
        }
    };
    // Remove department
    const handleRemoveDepartment = async (id) => {
        if (!window.confirm('Weet je zeker dat je deze afdeling wilt verwijderen?')) return;
        try {
            // Check if we're using fallback departments
            const isUsingFallback = departments.some(dep => dep.id.startsWith('default-'));
            
            if (isUsingFallback) {
                // Remove from local state only
                setDepartments(departments.filter(dep => dep.id !== id));
                setMessage('Afdeling verwijderd (lokaal)');
            } else {
                // Remove from Airtable
            await base('Afdelingen').destroy([id]);
            setDepartments(departments.filter(dep => dep.id !== id));
                setMessage('Afdeling succesvol verwijderd!');
            }
        } catch (err) {
            console.error('Error removing department:', err);
            setError(`Fout bij verwijderen afdeling: ${err.message || 'Onbekende fout'}`);
        }
    };
    // Start editing department
    const handleEditDepartment = (id, name) => {
        setEditingDepartmentId(id);
        setEditingDepartmentName(name);
    };
    // Save department name
    const handleSaveDepartment = async (id) => {
        try {
            // Check if we're using fallback departments
            const isUsingFallback = departments.some(dep => dep.id.startsWith('default-'));
            if (isUsingFallback) {
                // Update local state only
                setDepartments(departments.map(dep => dep.id === id ? { ...dep, name: editingDepartmentName } : dep));
                setEditingDepartmentId(null);
                setEditingDepartmentName('');
                setMessage('Afdeling hernoemd (lokaal)');
            } else {
                // Update in Airtable
                await base('Afdelingen').update([{ id, fields: { Naam: editingDepartmentName } }]);
                setDepartments(departments.map(dep => dep.id === id ? { ...dep, name: editingDepartmentName } : dep));
                setEditingDepartmentId(null);
                setEditingDepartmentName('');
                setMessage('Afdeling succesvol hernoemd!');
            }
        } catch (err) {
            console.error('Error saving department:', err);
            setError(`Fout bij hernoemen afdeling: ${err.message || 'Onbekende fout'}`);
        }
    };
    // Cancel editing
    const handleCancelEdit = () => {
        setEditingDepartmentId(null);
        setEditingDepartmentName('');
    };

    // Voeg tab state toe voor admins
    // UI: admin = tabs, anders rooster-overzicht
    if (user && user.isAdmin) {
        return (
            <div style={{ maxWidth: 1000, margin: '20px auto', padding: window.innerWidth <= 700 ? '12px 8px' : '16px', background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '20px' }}>
                <h2 style={{ fontSize: window.innerWidth <= 700 ? '20px' : '24px', marginBottom: '15px' }}>Teamrooster</h2>
                {/* Tabs */}
                <div style={{ 
                    display: 'flex', 
                    gap: window.innerWidth <= 700 ? 8 : 16, 
                    marginBottom: 24,
                    flexDirection: window.innerWidth <= 700 ? 'column' : 'row'
                }}>
                    <button
                        onClick={() => setAdminTab('beheer')}
                        style={{
                            padding: window.innerWidth <= 700 ? '12px 16px' : '8px 20px',
                            borderRadius: 6,
                            border: adminTab === 'beheer' ? '2px solid #007bff' : '1px solid #ccc',
                            background: adminTab === 'beheer' ? '#e9f2ff' : '#f8f9fa',
                            color: adminTab === 'beheer' ? '#007bff' : '#333',
                            fontWeight: adminTab === 'beheer' ? 700 : 500,
                            fontSize: window.innerWidth <= 700 ? 14 : 16,
                            cursor: 'pointer',
                            outline: 'none',
                            boxShadow: adminTab === 'beheer' ? '0 2px 8px rgba(0,123,255,0.08)' : 'none',
                            width: window.innerWidth <= 700 ? '100%' : 'auto'
                        }}
                    >
                        Beheren
                    </button>
                    <button
                        onClick={() => setAdminTab('bekijken')}
                        style={{
                            padding: window.innerWidth <= 700 ? '12px 16px' : '8px 20px',
                            borderRadius: 6,
                            border: adminTab === 'bekijken' ? '2px solid #007bff' : '1px solid #ccc',
                            background: adminTab === 'bekijken' ? '#e9f2ff' : '#f8f9fa',
                            color: adminTab === 'bekijken' ? '#007bff' : '#333',
                            fontWeight: adminTab === 'bekijken' ? 700 : 500,
                            fontSize: window.innerWidth <= 700 ? 14 : 16,
                            cursor: 'pointer',
                            outline: 'none',
                            boxShadow: adminTab === 'bekijken' ? '0 2px 8px rgba(0,123,255,0.08)' : 'none',
                            width: window.innerWidth <= 700 ? '100%' : 'auto'
                        }}
                    >
                        Rooster bekijken
                    </button>
                    <button
                        onClick={() => setAdminTab('verwijderen')}
                        style={{
                            padding: window.innerWidth <= 700 ? '12px 16px' : '8px 20px',
                            borderRadius: 6,
                            border: adminTab === 'verwijderen' ? '2px solid #dc3545' : '1px solid #ccc',
                            background: adminTab === 'verwijderen' ? '#ffe6e6' : '#f8f9fa',
                            color: adminTab === 'verwijderen' ? '#dc3545' : '#333',
                            fontWeight: adminTab === 'verwijderen' ? 700 : 500,
                            fontSize: window.innerWidth <= 700 ? 14 : 16,
                            cursor: 'pointer',
                            outline: 'none',
                            boxShadow: adminTab === 'verwijderen' ? '0 2px 8px rgba(220,53,69,0.08)' : 'none',
                            width: window.innerWidth <= 700 ? '100%' : 'auto'
                        }}
                    >
                        Verwijderen
                    </button>
                </div>
                {/* Tab inhoud */}
                {adminTab === 'beheer' ? (
                    // BEHEER UI
                    <>
                        {/* Afdelingen beheren */}
                        <div style={{ marginBottom: 32 }}>
                            <h3 style={{ fontSize: 18, marginBottom: 8 }}>Afdelingen beheren</h3>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                <input
                                    type="text"
                                    value={newDepartment}
                                    onChange={e => setNewDepartment(e.target.value)}
                                    placeholder="Nieuwe afdeling"
                                    style={{ padding: 6, borderRadius: 4, border: '1px solid #ccc', fontSize: 15 }}
                                />
                                <button onClick={handleAddDepartment} style={{ padding: '6px 16px', borderRadius: 4, background: '#007bff', color: '#fff', border: 'none', fontWeight: 600, fontSize: 15 }}>Toevoegen</button>
                            </div>
                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                {departments.map(dep => (
                                    <li key={dep.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        {editingDepartmentId === dep.id ? (
                                            <>
                                                <input
                                                    type="text"
                                                    value={editingDepartmentName}
                                                    onChange={e => setEditingDepartmentName(e.target.value)}
                                                    style={{ padding: 4, borderRadius: 3, border: '1px solid #ccc', fontSize: 14 }}
                                                />
                                                <button onClick={() => handleSaveDepartment(dep.id)} style={{ padding: '2px 8px', fontSize: 13, borderRadius: 3, background: '#28a745', color: '#fff', border: 'none' }}>Opslaan</button>
                                                <button onClick={handleCancelEdit} style={{ padding: '2px 8px', fontSize: 13, borderRadius: 3, background: '#6c757d', color: '#fff', border: 'none' }}>Annuleren</button>
                                            </>
                                        ) : (
                                            <>
                                                <span style={{ fontSize: 15 }}>{dep.name}</span>
                                                <button onClick={() => handleEditDepartment(dep.id, dep.name)} style={{ padding: '2px 8px', fontSize: 13, borderRadius: 3, background: '#ffc107', color: '#333', border: 'none' }}>Bewerken</button>
                                                <button onClick={() => handleRemoveDepartment(dep.id)} style={{ padding: '2px 8px', fontSize: 13, borderRadius: 3, background: '#dc3545', color: '#fff', border: 'none' }}>Verwijderen</button>
                                            </>
                                        )}
                                        </li>
                                    ))}
                                </ul>
                        </div>
                        {/* Rooster aanmaken */}
                        <div style={{ marginBottom: 32 }}>
                            <h3 style={{ fontSize: window.innerWidth <= 700 ? 16 : 18, marginBottom: 8 }}>Rooster aanmaken</h3>
                            <div style={{ 
                                display: 'flex', 
                                flexWrap: 'wrap', 
                                gap: window.innerWidth <= 700 ? 8 : 12, 
                                marginBottom: 12,
                                flexDirection: window.innerWidth <= 700 ? 'column' : 'row'
                            }}>
                                <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} style={{ 
                                    fontSize: window.innerWidth <= 700 ? 14 : 15, 
                                    padding: window.innerWidth <= 700 ? 10 : 6, 
                                    borderRadius: 4, 
                                    border: '1px solid #ccc',
                                    width: window.innerWidth <= 700 ? '100%' : 'auto'
                                }}>
                                    <option value="">Kies evenement...</option>
                                    {events.map(ev => (
                                        <option key={ev.id} value={ev.id}>{ev.name}</option>
                                    ))}
                                </select>
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ 
                                    fontSize: window.innerWidth <= 700 ? 14 : 15, 
                                    padding: window.innerWidth <= 700 ? 10 : 6, 
                                    borderRadius: 4, 
                                    border: '1px solid #ccc',
                                    width: window.innerWidth <= 700 ? '100%' : 'auto'
                                }} />
                                <select value={afdeling} onChange={e => setAfdeling(e.target.value)} style={{ 
                                    fontSize: window.innerWidth <= 700 ? 14 : 15, 
                                    padding: window.innerWidth <= 700 ? 10 : 6, 
                                    borderRadius: 4, 
                                    border: '1px solid #ccc',
                                    width: window.innerWidth <= 700 ? '100%' : 'auto'
                                }}>
                                    {departments.map(dep => (
                                        <option key={dep.id} value={dep.name}>{dep.name}</option>
                                    ))}
                                </select>
                                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ 
                                    fontSize: window.innerWidth <= 700 ? 14 : 15, 
                                    padding: window.innerWidth <= 700 ? 10 : 6, 
                                    borderRadius: 4, 
                                    border: '1px solid #ccc',
                                    width: window.innerWidth <= 700 ? '100%' : 'auto'
                                }} />
                                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ 
                                    fontSize: window.innerWidth <= 700 ? 14 : 15, 
                                    padding: window.innerWidth <= 700 ? 10 : 6, 
                                    borderRadius: 4, 
                                    border: '1px solid #ccc',
                                    width: window.innerWidth <= 700 ? '100%' : 'auto'
                                }} />
                                <select value={selectedVolunteer} onChange={e => setSelectedVolunteer(e.target.value)} style={{ 
                                    fontSize: window.innerWidth <= 700 ? 14 : 15, 
                                    padding: window.innerWidth <= 700 ? 10 : 6, 
                                    borderRadius: 4, 
                                    border: '1px solid #ccc',
                                    width: window.innerWidth <= 700 ? '100%' : 'auto'
                                }}>
                                    <option value="">Kies vrijwilliger...</option>
                                    {volunteers.map(v => (
                                        <option key={v.id} value={v.id}>{v.nickname || v.name}</option>
                                    ))}
                                </select>
                                <button onClick={handleCreateRooster} style={{ 
                                    padding: window.innerWidth <= 700 ? '12px 20px' : '6px 16px', 
                                    borderRadius: 4, 
                                    background: '#007bff', 
                                    color: '#fff', 
                                    border: 'none', 
                                    fontWeight: 600, 
                                    fontSize: window.innerWidth <= 700 ? 14 : 15,
                                    width: window.innerWidth <= 700 ? '100%' : 'auto'
                                }}>Toevoegen</button>
                            </div>
                        </div>
                        {/* Einde beheer UI */}
                        {message && <p style={{color: 'green', marginTop: 16, fontSize: window.innerWidth <= 700 ? '14px' : '16px'}}>{message}</p>}
                        {error && <p style={{color: 'red', marginTop: 16, fontSize: window.innerWidth <= 700 ? '14px' : '16px'}}>{error}</p>}
                    </>
                ) : adminTab === 'verwijderen' ? (
                    // VERWIJDEREN UI
                    <>
                        <div style={{ marginBottom: 24 }}>
                            <h3 style={{ fontSize: 18, marginBottom: 16, color: '#dc3545' }}>Roosterblokken verwijderen</h3>
                            <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
                                Selecteer de roosterblokken die je wilt verwijderen en klik op "Geselecteerde verwijderen".
                            </p>
                            
                            {/* Evenement en datum selectie */}
                            <div style={{ 
                                display: 'flex', 
                                gap: window.innerWidth <= 700 ? 8 : 12, 
                                marginBottom: 16, 
                                flexWrap: 'wrap',
                                flexDirection: window.innerWidth <= 700 ? 'column' : 'row'
                            }}>
                                <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)} style={{ 
                                    fontSize: window.innerWidth <= 700 ? 14 : 15, 
                                    padding: window.innerWidth <= 700 ? 10 : 6, 
                                    borderRadius: 4, 
                                    border: '1px solid #ccc',
                                    width: window.innerWidth <= 700 ? '100%' : 'auto'
                                }}>
                                    <option value="">Kies evenement...</option>
                                    {events.map(ev => (
                                        <option key={ev.id} value={ev.id}>{ev.name}</option>
                                    ))}
                                </select>
                                <select value={selectedRoosterDate} onChange={e => setSelectedRoosterDate(e.target.value)} style={{ 
                                    fontSize: window.innerWidth <= 700 ? 14 : 15, 
                                    padding: window.innerWidth <= 700 ? 10 : 6, 
                                    borderRadius: 4, 
                                    border: '1px solid #ccc',
                                    width: window.innerWidth <= 700 ? '100%' : 'auto'
                                }}>
                                    <option value="">Kies dag...</option>
                                    {(() => {
                                        const eventObj = events.find(ev => ev.id === filterEvent);
                                        const eventDates = eventObj ? (() => {
                                            const dates = [];
                                            if (!eventObj.start || !eventObj.end) return dates;
                                            let d = new Date(eventObj.start);
                                            const end = new Date(eventObj.end);
                                            while (d <= end) {
                                                dates.push(d.toISOString().slice(0, 10));
                                                d.setDate(d.getDate() + 1);
                                            }
                                            return dates;
                                        })() : [];
                                        return eventDates.map(date => (
                                            <option key={date} value={date}>{new Date(date).toLocaleDateString('nl-NL', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</option>
                                        ));
                                    })()}
                                </select>
                            </div>

                            {/* Geselecteerde blokken teller en verwijder knop */}
                            {selectedBlocksToDelete.length > 0 && (
                                <div style={{ 
                                    background: '#fff3cd', 
                                    border: '1px solid #ffeaa7', 
                                    borderRadius: 6, 
                                    padding: window.innerWidth <= 700 ? 16 : 12, 
                                    marginBottom: 16,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexDirection: window.innerWidth <= 700 ? 'column' : 'row',
                                    gap: window.innerWidth <= 700 ? 12 : 0
                                }}>
                                    <span style={{ fontSize: window.innerWidth <= 700 ? 13 : 14, color: '#856404' }}>
                                        {selectedBlocksToDelete.length} blok(ken) geselecteerd
                                    </span>
                                    <button 
                                        onClick={handleDeleteSelectedBlocks}
                                        disabled={loading}
                                        style={{ 
                                            background: '#dc3545', 
                                            color: 'white', 
                                            border: 'none', 
                                            borderRadius: 4, 
                                            padding: window.innerWidth <= 700 ? '12px 20px' : '8px 16px', 
                                            fontSize: window.innerWidth <= 700 ? 13 : 14, 
                                            cursor: loading ? 'not-allowed' : 'pointer',
                                            opacity: loading ? 0.6 : 1,
                                            width: window.innerWidth <= 700 ? '100%' : 'auto'
                                        }}
                                    >
                                        {loading ? 'Verwijderen...' : 'Geselecteerde verwijderen'}
                                    </button>
                                </div>
                            )}

                            {/* Lijst van roosterblokken om te verwijderen */}
                            {filterEvent && selectedRoosterDate ? (
                                <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 16 }}>
                                    <h4 style={{ fontSize: 16, marginBottom: 12 }}>Roosterblokken voor {new Date(selectedRoosterDate).toLocaleDateString('nl-NL')}</h4>
                                    {(() => {
                                        const eventObj = events.find(ev => ev.id === filterEvent);
                                        const blocksForDay = roosterRecords.filter(r => 
                                            r.date === selectedRoosterDate && 
                                            r.event === (eventObj?.name)
                                        );
                                        
                                        if (blocksForDay.length === 0) {
                                            return (
                                                <p style={{ color: '#6c757d', fontSize: 14, textAlign: 'center', padding: 20 }}>
                                                    Geen roosterblokken gevonden voor deze dag.
                                                </p>
                                            );
                                        }
                                        
                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {blocksForDay.filter(block => block.id && block.id.trim() !== '').map((block, index) => {
                                                    console.log('Block for deletion:', block); // Debug log
                                                    return (
                                                        <div 
                                                            key={block.id || index}
                                                            style={{ 
                                                                background: 'white', 
                                                                border: '1px solid #dee2e6', 
                                                                borderRadius: 6, 
                                                                padding: 12,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 12
                                                            }}
                                                        >
                                                            <input 
                                                                type="checkbox"
                                                                checked={selectedBlocksToDelete.includes(block.id)}
                                                                onChange={() => toggleBlockSelection(block.id)}
                                                                style={{ width: 18, height: 18 }}
                                                            />
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                                                                    {block.volunteer}
                                                                </div>
                                                                <div style={{ fontSize: 13, color: '#666' }}>
                                                                    {block.afdeling} • {new Date(block.start).toLocaleTimeString('nl-NL', {hour:'2-digit',minute:'2-digit'})} - {new Date(block.end).toLocaleTimeString('nl-NL', {hour:'2-digit',minute:'2-digit'})}
                                                                </div>
                                                                <div style={{ fontSize: 11, color: '#999' }}>
                                                                    ID: {block.id}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div style={{ 
                                    background: '#f8f9fa', 
                                    borderRadius: 8, 
                                    padding: 20, 
                                    textAlign: 'center',
                                    border: '1px solid #dee2e6'
                                }}>
                                    <p style={{ margin: 0, fontSize: 14, color: '#6c757d' }}>
                                        Selecteer eerst een evenement en dag om roosterblokken te zien.
                                    </p>
                                </div>
                            )}
                        </div>
                        {message && <p style={{color: 'green', marginTop: 16, fontSize: window.innerWidth <= 700 ? '14px' : '16px'}}>{message}</p>}
                        {error && <p style={{color: 'red', marginTop: 16, fontSize: window.innerWidth <= 700 ? '14px' : '16px'}}>{error}</p>}
                    </>
                ) : (
                    // MATRIX UI
                    <>
                        {/* Evenement-selectie boven de matrix */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 16, marginRight: 8 }}>Kies evenement:</label>
                            <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)} style={{ fontSize: 16, padding: 6, borderRadius: 4, border: '1px solid #ccc' }}>
                                <option value="">Kies een evenement...</option>
                                {events.map(ev => (
                                    <option key={ev.id} value={ev.id}>{ev.name}</option>
                                ))}
                            </select>
                        </div>
                        {/* Matrixweergave zoals medewerkers */}
                        {/* Bepaal alle datums voor het geselecteerde event */}
                        {(() => {
                            const eventObj = events.find(ev => ev.id === filterEvent);
                            const eventDates = eventObj ? (() => {
                              const dates = [];
                              if (!eventObj.start || !eventObj.end) return dates;
                              let d = new Date(eventObj.start);
                              const end = new Date(eventObj.end);
                              while (d <= end) {
                                dates.push(d.toISOString().slice(0, 10));
                                d.setDate(d.getDate() + 1);
                              }
                              return dates;
                            })() : [];
                            const hours = Array.from({length: 16}, (_, i) => `${(7+i).toString().padStart(2,'0')}:00`);
                            const roosterForDay = roosterRecords.filter(r => r.date === selectedRoosterDate && r.event === (eventObj?.name));
                            const uniqueVolunteers = Array.from(new Set(roosterForDay.map(r => r.volunteer)));
                            const afdelingColors = {};
                            const colorList = ['#e57373','#64b5f6','#81c784','#ffd54f','#ba68c8','#4db6ac','#f06292','#a1887f','#90a4ae','#ff8a65','#9fa8da','#80cbc4','#ffcc02','#ab47bc','#26a69a'];
                            departments.forEach((dep, i) => { afdelingColors[dep.name] = colorList[i % colorList.length]; });
                            function getBlocksForHour(volunteer, hour) {
                              return roosterForDay.filter(r => {
                                if (r.volunteer !== volunteer) return false;
                                const start = r.start ? new Date(r.start) : null;
                                const end = r.end ? new Date(r.end) : null;
                                if (!start || !end) return false;
                                const blockHour = new Date(`${selectedRoosterDate}T${hour}:00`);
                                return blockHour >= start && blockHour < end;
                              });
                            }
                            return filterEvent && eventDates.length > 0 ? (
                                <div style={{ marginBottom: 24 }}>
                                    <div style={{ marginBottom: 12 }}>
                                        <label style={{ fontSize: 16, marginRight: 8 }}>Kies dag:</label>
                                        <select value={selectedRoosterDate} onChange={e => setSelectedRoosterDate(e.target.value)} style={{ fontSize: 16, padding: 6, borderRadius: 4, border: '1px solid #ccc' }}>
                                            <option value="">Kies een dag...</option>
                                            {eventDates.map(date => (
                                                <option key={date} value={date}>{new Date(date).toLocaleDateString('nl-NL', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {selectedRoosterDate ? (
                                        <div style={{ 
                                            overflowX: 'auto', 
                                            background: '#fff', 
                                            borderRadius: 8, 
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                            maxWidth: '100%'
                                        }}>
                                            <table style={{ 
                                                width: '100%', 
                                                borderCollapse: 'collapse', 
                                                minWidth: window.innerWidth <= 700 ? 600 : 800,
                                                fontSize: window.innerWidth <= 700 ? 12 : 14
                                            }}>
                                <thead>
                                    <tr>
                                                        <th style={{ 
                                                            background: '#f8f9fa', 
                                                            padding: window.innerWidth <= 700 ? 8 : 12, 
                                                            minWidth: window.innerWidth <= 700 ? 120 : 150, 
                                                            borderBottom: '2px solid #dee2e6',
                                                            borderRight: '1px solid #dee2e6',
                                                            fontSize: window.innerWidth <= 700 ? 12 : 14,
                                                            fontWeight: 600,
                                                            textAlign: 'left'
                                                        }}>
                                                            Vrijwilliger
                                                        </th>
                                                        {hours.map(hour => (
                                                            <th key={hour} style={{ 
                                                                background: '#f8f9fa', 
                                                                padding: window.innerWidth <= 700 ? 4 : 8, 
                                                                borderBottom: '2px solid #dee2e6',
                                                                borderRight: '1px solid #dee2e6',
                                                                fontSize: window.innerWidth <= 700 ? 10 : 12,
                                                                fontWeight: 600,
                                                                textAlign: 'center',
                                                                minWidth: window.innerWidth <= 700 ? 45 : 60
                                                            }}>
                                                                {hour}
                                                            </th>
                                                ))}
                                    </tr>
                                </thead>
                                <tbody>
                                                    {uniqueVolunteers.length > 0 ? (
                                                        uniqueVolunteers.map(vol => (
                                                            <tr key={vol}>
                                                                <td style={{ 
                                                                    fontWeight: 600, 
                                                                    padding: 12, 
                                                                    borderBottom: '1px solid #dee2e6',
                                                                    borderRight: '1px solid #dee2e6',
                                                                    background: '#fafafa',
                                                                    fontSize: 14
                                                                }}>
                                                                    {vol}
                                                                </td>
                                                                {hours.map(hour => {
                                                                    const blocks = getBlocksForHour(vol, hour);
                                                                    return (
                                                                        <td key={hour} style={{ 
                                                                            minWidth: 60, 
                                                                            border: '1px solid #dee2e6', 
                                                                            verticalAlign: 'top', 
                                                                            padding: 4,
                                                                            background: '#fff',
                                                                            position: 'relative'
                                                                        }}>
                                                                            {blocks.length > 0 ? (
                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                                                    {blocks.map((block, index) => (
                                                                                        <div 
                                                                                            key={`${block.id}-${index}`}
                                                                                            style={{ 
                                                                                                background: afdelingColors[block.afdeling] || '#e9ecef', 
                                                                                                color: '#222', 
                                                                                                borderRadius: 4, 
                                                                                                padding: '4px 6px', 
                                                                                                fontSize: 11, 
                                                                                                fontWeight: 500,
                                                                                                textAlign: 'center',
                                                                                                border: '1px solid rgba(0,0,0,0.1)',
                                                                                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                                                                                cursor: 'default'
                                                                                            }}
                                                                                            title={`${block.afdeling} - ${new Date(block.start).toLocaleTimeString('nl-NL', {hour:'2-digit',minute:'2-digit'})} - ${new Date(block.end).toLocaleTimeString('nl-NL', {hour:'2-digit',minute:'2-digit'})}`}
                                                                                        >
                                                                                            {block.afdeling}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            ) : (
                                                                                <div style={{ 
                                                                                    height: 20, 
                                                                                    background: '#f8f9fa', 
                                                                                    borderRadius: 2,
                                                                                    border: '1px dashed #dee2e6'
                                                                                }}></div>
                                                            )}
                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan={hours.length + 1} style={{ 
                                                                padding: 20, 
                                                                textAlign: 'center', 
                                                                color: '#6c757d',
                                                                fontSize: 14
                                                            }}>
                                                                Geen vrijwilligers ingeroosterd voor deze dag
                                                            </td>
                                            </tr>
                                                    )}
                                </tbody>
                            </table>
                                            {/* Legenda */}
                                            {departments.length > 0 && (
                                                <div style={{ 
                                                    marginTop: 16, 
                                                    padding: window.innerWidth <= 700 ? 12 : 16, 
                                                    background: '#f8f9fa', 
                                                    borderTop: '1px solid #dee2e6',
                                                    display: 'flex', 
                                                    gap: window.innerWidth <= 700 ? 8 : 16, 
                                                    flexWrap: 'wrap',
                                                    alignItems: 'center',
                                                    flexDirection: window.innerWidth <= 700 ? 'column' : 'row'
                                                }}>
                                                    <span style={{ fontWeight: 600, fontSize: window.innerWidth <= 700 ? 12 : 14 }}>Legenda:</span>
                                                    <div style={{ 
                                                        display: 'flex', 
                                                        gap: window.innerWidth <= 700 ? 6 : 8, 
                                                        flexWrap: 'wrap',
                                                        justifyContent: window.innerWidth <= 700 ? 'center' : 'flex-start'
                                                    }}>
                                                        {departments.map(dep => (
                                                            <span key={dep.name} style={{ 
                                                                display: 'inline-flex', 
                                                                alignItems: 'center', 
                                                                gap: window.innerWidth <= 700 ? 4 : 8,
                                                                padding: window.innerWidth <= 700 ? '3px 6px' : '4px 8px',
                                                                background: '#fff',
                                                                borderRadius: 4,
                                                                border: '1px solid #dee2e6',
                                                                fontSize: window.innerWidth <= 700 ? 11 : 13
                                                            }}>
                                                                <span style={{ 
                                                                    width: window.innerWidth <= 700 ? 12 : 16, 
                                                                    height: window.innerWidth <= 700 ? 12 : 16, 
                                                                    background: afdelingColors[dep.name], 
                                                                    display: 'inline-block', 
                                                                    borderRadius: 3, 
                                                                    border: '1px solid rgba(0,0,0,0.1)'
                                                                }}></span>
                                                                <span style={{ fontSize: window.innerWidth <= 700 ? 11 : 13, fontWeight: 500 }}>{dep.name}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ 
                                            padding: 20, 
                                            textAlign: 'center', 
                                            color: '#6c757d',
                                            background: '#f8f9fa',
                                            borderRadius: 8,
                                            border: '1px solid #dee2e6'
                                        }}>
                                            <p style={{ margin: 0, fontSize: 14 }}>Kies eerst een dag om het rooster te zien.</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ 
                                    padding: 20, 
                                    textAlign: 'center', 
                                    color: '#6c757d',
                                    background: '#f8f9fa',
                                    borderRadius: 8,
                                    border: '1px solid #dee2e6'
                                }}>
                                    <p style={{ margin: 0, fontSize: 14 }}>
                                        {!filterEvent ? 'Selecteer eerst een evenement om het rooster te bekijken.' : 
                                         eventDates.length === 0 ? 'Geen geldige datums gevonden voor dit evenement.' : 
                                         'Geen evenementen gevonden voor dit rooster.'}
                                    </p>
                        </div>
                            );
                        })()}
                        {message && <p style={{color: 'green', marginTop: 16, fontSize: window.innerWidth <= 700 ? '14px' : '16px'}}>{message}</p>}
                        {error && <p style={{color: 'red', marginTop: 16, fontSize: window.innerWidth <= 700 ? '14px' : '16px'}}>{error}</p>}
                    </>
                )}
            </div>
        );
    }

    // Medewerkers: alleen matrixweergave
    // Bepaal alle datums voor het geselecteerde event
    const eventObj = events.find(ev => ev.id === filterEvent);
    const eventDates = eventObj ? (() => {
      const dates = [];
      if (!eventObj.start || !eventObj.end) return dates;
      let d = new Date(eventObj.start);
      const end = new Date(eventObj.end);
      while (d <= end) {
        dates.push(d.toISOString().slice(0, 10));
        d.setDate(d.getDate() + 1);
      }
      return dates;
    })() : [];

    // Uren: 07:00 t/m 22:00 (uitgebreidere tijdsrange)
    const hours = Array.from({length: 16}, (_, i) => `${(7+i).toString().padStart(2,'0')}:00`);

    // Vrijwilligers op geselecteerde dag
    const roosterForDay = roosterRecords.filter(r => r.date === selectedRoosterDate && r.event === (eventObj?.name));
    const uniqueVolunteers = Array.from(new Set(roosterForDay.map(r => r.volunteer)));

    // Kleur per afdeling
    const afdelingColors = {};
    const colorList = ['#e57373','#64b5f6','#81c784','#ffd54f','#ba68c8','#4db6ac','#f06292','#a1887f','#90a4ae','#ff8a65','#9fa8da','#80cbc4','#ffcc02','#ab47bc','#26a69a'];
    departments.forEach((dep, i) => { afdelingColors[dep.name] = colorList[i % colorList.length]; });

    // Helper: check of vrijwilliger werkt op uur
    function getBlock(volunteer, hour) {
      return roosterForDay.find(r => {
        if (r.volunteer !== volunteer) return false;
        const start = r.start ? new Date(r.start) : null;
        const end = r.end ? new Date(r.end) : null;
        if (!start || !end) return false;
        const blockHour = new Date(`${selectedRoosterDate}T${hour}:00`);
        return blockHour >= start && blockHour < end;
      });
    }

    // Helper: check of er meerdere blokken zijn voor dezelfde vrijwilliger op hetzelfde uur
    function getBlocksForHour(volunteer, hour) {
      return roosterForDay.filter(r => {
        if (r.volunteer !== volunteer) return false;
        const start = r.start ? new Date(r.start) : null;
        const end = r.end ? new Date(r.end) : null;
        if (!start || !end) return false;
        const blockHour = new Date(`${selectedRoosterDate}T${hour}:00`);
        return blockHour >= start && blockHour < end;
      });
    }

    // Voeg bovenaan toe:
    // Functie om modal te openen
    function openEditModal(volunteer) {
        // Haal alle blokken voor deze vrijwilliger en dag
        const blocks = roosterForDay.filter(r => r.volunteer === volunteer);
        setEditBlocks(blocks.map(b => ({ ...b })));
    }
    // Functie om modal te sluiten
    function closeEditModal() {
        setEditBlocks([]);
    }
    // Functie om wijzigingen op te slaan
    async function saveEditBlocks() {
        setLoading(true);
        setError('');
        try {
            // Update elk blok in Airtable
            for (const block of editBlocks) {
                await base('Team Roosters').update([{
                    id: block.id,
                    fields: {
                        'Afdeling': [block.afdeling],
                        'Start tijd': block.start,
                        'Eind tijd': block.end
                    }
                }]);
            }
            setMessage('Rooster bijgewerkt!');
            closeEditModal();
            // Refresh rooster data
            setTimeout(() => window.location.reload(), 1000);
        } catch (err) {
            setError('Fout bij opslaan rooster.');
        }
        setLoading(false);
    }

    async function handleDeleteBlock(blockId) {
        setLoading(true);
        setError('');
        try {
            await base('Team Roosters').destroy([blockId]);
            setMessage('Roosterblok verwijderd!');
            // Refresh rooster data
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (err) {
            console.error('Error deleting block:', err);
            setError('Fout bij verwijderen roosterblok.');
        }
        setLoading(false);
    }

    // Nieuwe functie voor het verwijderen van meerdere blokken
    async function handleDeleteSelectedBlocks() {
        if (selectedBlocksToDelete.length === 0) {
            setError('Selecteer eerst roosterblokken om te verwijderen.');
            return;
        }
        
        // Filter alleen geldige IDs
        const validIds = selectedBlocksToDelete.filter(id => id && id.trim() !== '');
        
        if (validIds.length === 0) {
            setError('Geen geldige roosterblokken geselecteerd.');
            return;
        }
        
        if (!window.confirm(`Weet je zeker dat je ${validIds.length} roosterblok(ken) wilt verwijderen?`)) {
            return;
        }
        
        setLoading(true);
        setError('');
        try {
            console.log('Deleting blocks with IDs:', validIds);
            await base('Team Roosters').destroy(validIds);
            setMessage(`${validIds.length} roosterblok(ken) verwijderd!`);
            setSelectedBlocksToDelete([]);
            // Refresh rooster data
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (err) {
            console.error('Error deleting blocks:', err);
            console.error('Valid IDs:', validIds);
            setError(`Fout bij verwijderen roosterblokken: ${err.message}`);
        }
        setLoading(false);
    }

    // Functie om blokken te selecteren voor verwijdering
    function toggleBlockSelection(blockId) {
        setSelectedBlocksToDelete(prev => 
            prev.includes(blockId) 
                ? prev.filter(id => id !== blockId)
                : [...prev, blockId]
        );
    }

    return (
        <div style={{ 
            maxWidth: 1000, 
            margin: '20px auto', 
            padding: window.innerWidth <= 700 ? '12px 8px' : '16px', 
            background: '#fff', 
            borderRadius: 8, 
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)', 
            marginBottom: '20px',
            width: '100%',
            boxSizing: 'border-box'
        }}>
            <h2 style={{ fontSize: window.innerWidth <= 700 ? '20px' : '24px', marginBottom: '15px' }}>Teamrooster</h2>
            {/* Evenement-selectie boven de matrix */}
            <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: window.innerWidth <= 700 ? 14 : 16, marginRight: 8 }}>Kies evenement:</label>
                <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)} style={{ 
                    fontSize: window.innerWidth <= 700 ? 14 : 16, 
                    padding: window.innerWidth <= 700 ? 8 : 6, 
                    borderRadius: 4, 
                    border: '1px solid #ccc',
                    width: window.innerWidth <= 700 ? '100%' : 'auto'
                }}>
                    <option value="">Kies een evenement...</option>
                    {events.map(ev => (
                        <option key={ev.id} value={ev.id}>{ev.name}</option>
                    ))}
                </select>
            </div>
            {/* Matrixweergave voor iedereen */}
            {filterEvent && eventDates.length > 0 ? (
                <div style={{ marginBottom: 24 }}>
                    <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: window.innerWidth <= 700 ? 14 : 16, marginRight: 8 }}>Kies dag:</label>
                        <select value={selectedRoosterDate} onChange={e => setSelectedRoosterDate(e.target.value)} style={{ 
                            fontSize: window.innerWidth <= 700 ? 14 : 16, 
                            padding: window.innerWidth <= 700 ? 8 : 6, 
                            borderRadius: 4, 
                            border: '1px solid #ccc',
                            width: window.innerWidth <= 700 ? '100%' : 'auto'
                        }}>
                            <option value="">Kies een dag...</option>
                            {eventDates.map(date => (
                                <option key={date} value={date}>{new Date(date).toLocaleDateString('nl-NL', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</option>
                            ))}
                        </select>
                    </div>
                    {selectedRoosterDate ? (
                        <div style={{ 
                            overflowX: 'auto', 
                            background: '#fff', 
                            borderRadius: 8, 
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            maxWidth: '100%'
                        }}>
                            <table style={{ 
                                width: '100%', 
                                borderCollapse: 'collapse', 
                                minWidth: window.innerWidth <= 700 ? 600 : 800,
                                fontSize: window.innerWidth <= 700 ? 12 : 14
                            }}>
                        <thead>
                            <tr>
                                        <th style={{ 
                                            background: '#f8f9fa', 
                                            padding: window.innerWidth <= 700 ? 8 : 12, 
                                            minWidth: window.innerWidth <= 700 ? 120 : 150, 
                                            borderBottom: '2px solid #dee2e6',
                                            borderRight: '1px solid #dee2e6',
                                            fontSize: window.innerWidth <= 700 ? 12 : 14,
                                            fontWeight: 600,
                                            textAlign: 'left'
                                        }}>
                                            Vrijwilliger
                                        </th>
                                        {hours.map(hour => (
                                            <th key={hour} style={{ 
                                                background: '#f8f9fa', 
                                                padding: window.innerWidth <= 700 ? 4 : 8, 
                                                borderBottom: '2px solid #dee2e6',
                                                borderRight: '1px solid #dee2e6',
                                                fontSize: window.innerWidth <= 700 ? 10 : 12,
                                                fontWeight: 600,
                                                textAlign: 'center',
                                                minWidth: window.innerWidth <= 700 ? 45 : 60
                                            }}>
                                                {hour}
                                            </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                                    {uniqueVolunteers.length > 0 ? (
                                        uniqueVolunteers.map(vol => (
                                            <tr key={vol}>
                                                <td style={{ 
                                                    fontWeight: 600, 
                                                    padding: window.innerWidth <= 700 ? 8 : 12, 
                                                    borderBottom: '1px solid #dee2e6',
                                                    borderRight: '1px solid #dee2e6',
                                                    background: '#fafafa',
                                                    fontSize: window.innerWidth <= 700 ? 12 : 14
                                                }}>
                                                    {vol}
                                                </td>
                                                {hours.map(hour => {
                                                    const blocks = getBlocksForHour(vol, hour);
                                                    return (
                                                        <td key={hour} style={{ 
                                                            minWidth: window.innerWidth <= 700 ? 45 : 60, 
                                                            border: '1px solid #dee2e6', 
                                                            verticalAlign: 'top', 
                                                            padding: window.innerWidth <= 700 ? 2 : 4,
                                                            background: '#fff',
                                                            position: 'relative'
                                                        }}>
                                                            {blocks.length > 0 ? (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: window.innerWidth <= 700 ? 1 : 2 }}>
                                                                    {blocks.map((block, index) => (
                                                                        <div 
                                                                            key={`${block.id}-${index}`}
                                                                            style={{ 
                                                                                background: afdelingColors[block.afdeling] || '#e9ecef', 
                                                                                color: '#222', 
                                                                                borderRadius: window.innerWidth <= 700 ? 2 : 4, 
                                                                                padding: window.innerWidth <= 700 ? '2px 4px' : '4px 6px', 
                                                                                fontSize: window.innerWidth <= 700 ? 9 : 11, 
                                                                                fontWeight: 500,
                                                                                textAlign: 'center',
                                                                                border: '1px solid rgba(0,0,0,0.1)',
                                                                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                                                                cursor: 'default'
                                                                            }}
                                                                            title={`${block.afdeling} - ${new Date(block.start).toLocaleTimeString('nl-NL', {hour:'2-digit',minute:'2-digit'})} - ${new Date(block.end).toLocaleTimeString('nl-NL', {hour:'2-digit',minute:'2-digit'})}`}
                                                                        >
                                                                            {block.afdeling}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div style={{ 
                                                                    height: window.innerWidth <= 700 ? 16 : 20, 
                                                                    background: '#f8f9fa', 
                                                                    borderRadius: 2,
                                                                    border: '1px dashed #dee2e6'
                                                                }}></div>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={hours.length + 1} style={{ 
                                                padding: window.innerWidth <= 700 ? 16 : 20, 
                                                textAlign: 'center', 
                                                color: '#6c757d',
                                                fontSize: window.innerWidth <= 700 ? 12 : 14
                                            }}>
                                                Geen vrijwilligers ingeroosterd voor deze dag
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                            {/* Legenda */}
                            {departments.length > 0 && (
                                <div style={{ 
                                    marginTop: 16, 
                                    padding: window.innerWidth <= 700 ? 12 : 16, 
                                    background: '#f8f9fa', 
                                    borderTop: '1px solid #dee2e6',
                                    display: 'flex', 
                                    gap: window.innerWidth <= 700 ? 8 : 16, 
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                    flexDirection: window.innerWidth <= 700 ? 'column' : 'row'
                                }}>
                                    <span style={{ fontWeight: 600, fontSize: window.innerWidth <= 700 ? 12 : 14 }}>Legenda:</span>
                                    <div style={{ 
                                        display: 'flex', 
                                        gap: window.innerWidth <= 700 ? 6 : 8, 
                                        flexWrap: 'wrap',
                                        justifyContent: window.innerWidth <= 700 ? 'center' : 'flex-start'
                                    }}>
                                        {departments.map(dep => (
                                            <span key={dep.name} style={{ 
                                                display: 'inline-flex', 
                                                alignItems: 'center', 
                                                gap: window.innerWidth <= 700 ? 4 : 8,
                                                padding: window.innerWidth <= 700 ? '3px 6px' : '4px 8px',
                                                background: '#fff',
                                                borderRadius: 4,
                                                border: '1px solid #dee2e6',
                                                fontSize: window.innerWidth <= 700 ? 11 : 13
                                            }}>
                                                <span style={{ 
                                                    width: window.innerWidth <= 700 ? 12 : 16, 
                                                    height: window.innerWidth <= 700 ? 12 : 16, 
                                                    background: afdelingColors[dep.name], 
                                                    display: 'inline-block', 
                                                    borderRadius: 3, 
                                                    border: '1px solid rgba(0,0,0,0.1)'
                                                }}></span>
                                                <span style={{ fontSize: window.innerWidth <= 700 ? 11 : 13, fontWeight: 500 }}>{dep.name}</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ 
                            padding: 20, 
                            textAlign: 'center', 
                            color: '#6c757d',
                            background: '#f8f9fa',
                            borderRadius: 8,
                            border: '1px solid #dee2e6'
                        }}>
                            <p style={{ margin: 0, fontSize: 14 }}>Kies eerst een dag om het rooster te zien.</p>
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ 
                    padding: 20, 
                    textAlign: 'center', 
                    color: '#6c757d',
                    background: '#f8f9fa',
                    borderRadius: 8,
                    border: '1px solid #dee2e6'
                }}>
                    <p style={{ margin: 0, fontSize: 14 }}>
                        {!filterEvent ? 'Selecteer eerst een evenement om het rooster te bekijken.' : 
                         eventDates.length === 0 ? 'Geen geldige datums gevonden voor dit evenement.' : 
                         'Geen evenementen gevonden voor dit rooster.'}
                    </p>
                </div>
            )}
            {message && <p style={{color: 'green', marginTop: 16, fontSize: window.innerWidth <= 700 ? '14px' : '16px'}}>{message}</p>}
            {error && <p style={{color: 'red', marginTop: 16, fontSize: window.innerWidth <= 700 ? '14px' : '16px'}}>{error}</p>}
        </div>
    );
} 