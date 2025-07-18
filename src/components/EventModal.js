import React, { useState, useEffect } from 'react';
import Airtable from 'airtable';
import '../App.css';

const base = new Airtable({
    apiKey: process.env.REACT_APP_AIRTABLE_API_KEY
}).base(process.env.REACT_APP_AIRTABLE_BASE_ID);

function EventModal({ event, user, onRegister, onUnregister, onClose, loading }) {
    const [roster, setRoster] = useState([]);
    const [rosterLoading, setRosterLoading] = useState(true);
    const [rosterError, setRosterError] = useState(null);
    const [selectedDays, setSelectedDays] = useState([]);

    useEffect(() => {
        if (!event) {
            return;
        }

        // Genereer alle dagen tussen start en eind datum
        const generateEventDays = () => {
            const days = [];
            const startDate = new Date(event.start);
            const endDate = new Date(event.end);
            
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                days.push(new Date(d));
            }
            return days;
        };

        const eventDays = generateEventDays();
        setSelectedDays(eventDays.map(day => day.toISOString().split('T')[0])); // Selecteer alle dagen standaard

        const fetchRoster = async () => {
            setRosterLoading(true);
            setRosterError(null);
            try {
                const records = await base('Team Roosters')
                    .select({
                        filterByFormula: `FIND('${event.resource.id}', ARRAYJOIN({Event Name}))`,
                        fields: ["Teamrooster", "Start tijd", "Eind tijd", "Afdeling", "Volunteer Name"]
                    })
                    .all();

                const volunteerIds = records.map(record => (record.get('Volunteer Name') ? record.get('Volunteer Name')[0] : null)).filter(Boolean);
                let volunteerNames = {};

                if (volunteerIds.length > 0) {
                    const filterFormula = "OR(" + volunteerIds.map(id => `RECORD_ID() = '${id}'`).join(',') + ")";
                    const volunteerRecords = await base('Vrijwilligers').select({
                        filterByFormula: filterFormula,
                        fields: ["Roepnaam"]
                    }).all();
                    volunteerRecords.forEach(record => {
                        volunteerNames[record.id] = record.get('Roepnaam');
                    });
                }
                
                const rosterData = records.map(record => {
                    const volunteerId = record.get('Volunteer Name') ? record.get('Volunteer Name')[0] : null;
                    return {
                        id: record.id,
                        name: volunteerId ? volunteerNames[volunteerId] : 'Onbekend',
                        startTime: record.get('Start tijd'),
                        endTime: record.get('Eind tijd'),
                        department: record.get('Afdeling')?.join(', ') || 'N/A'
                    };
                });
                setRoster(rosterData);
            } catch (err) {
                console.error("Error fetching roster:", err);
                setRosterError('Kon het rooster niet ophalen.');
            } finally {
                setRosterLoading(false);
            }
        };

        fetchRoster();

    }, [event]);

    if (!event) return null;

    // Check if user is registered for this event (both single-day and multi-day)
    const isRegistered = user['Opgegeven Evenementen']?.some(reg => reg === event.resource.id);

    const formatDate = (date) => new Date(date).toLocaleDateString('nl-NL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const formatTime = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleTimeString('nl-NL', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'UTC'
        });
    };

    const handleRegister = () => {
        // Check if this is a multi-day event
        const generateEventDays = () => {
            const days = [];
            const startDate = new Date(event.start);
            const endDate = new Date(event.end);
            
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                days.push(new Date(d));
            }
            return days;
        };

        const eventDays = generateEventDays();
        const isMultiDay = eventDays.length > 1;

        if (isMultiDay && selectedDays.length === 0) {
            alert('Selecteer ten minste één dag om je in te schrijven.');
            return;
        }
        
        // Voor multi-day events, sla de geselecteerde dagen op
        const registrationData = isMultiDay 
            ? { eventId: event.resource.id, selectedDays }
            : event.resource.id;
            
        onRegister(registrationData);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>{event.title}</h2>
                <p><strong>Start:</strong> {formatDate(event.start)}</p>
                <p><strong>Einde:</strong> {formatDate(event.end)}</p>
                <p>{event.resource.Benodigdheden}</p>

                {/* Multi-day day selection */}
                {(() => {
                    const generateEventDays = () => {
                        const days = [];
                        const startDate = new Date(event.start);
                        const endDate = new Date(event.end);
                        
                        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                            days.push(new Date(d));
                        }
                        return days;
                    };

                    const eventDays = generateEventDays();
                    const isMultiDay = eventDays.length > 1;

                    if (isMultiDay) {
                        return (
                            <div className="day-selection">
                                <h3>Selecteer de dagen waarop je beschikbaar bent:</h3>
                                <div className="day-checkboxes">
                                    {eventDays.map(day => {
                                        const dayString = day.toISOString().split('T')[0];
                                        const isSelected = selectedDays.includes(dayString);
                                        return (
                                            <label key={dayString} className="day-checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {
                                                        setSelectedDays(prev => 
                                                            prev.includes(dayString) 
                                                                ? prev.filter(d => d !== dayString)
                                                                : [...prev, dayString]
                                                        );
                                                    }}
                                                />
                                                <span>{formatDate(day)}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                {selectedDays.length === 0 && (
                                    <p style={{color: 'red', fontSize: '14px'}}>
                                        Selecteer ten minste één dag om je in te schrijven.
                                    </p>
                                )}
                            </div>
                        );
                    }
                    return null;
                })()}

                <div className="team-roster">
                    <h3>Teamrooster</h3>
                    {rosterLoading ? (
                        <p>Rooster wordt geladen...</p>
                    ) : rosterError ? (
                        <p className="error">{rosterError}</p>
                    ) : roster.length > 0 ? (
                        <table>
                            <thead>
                                <tr>
                                    <th>Vrijwilliger</th>
                                    <th>Afdeling</th>
                                    <th>Tijd</th>
                                </tr>
                            </thead>
                            <tbody>
                                {roster.map(member => (
                                    <tr key={member.id}>
                                        <td>{member.name}</td>
                                        <td>{member.department}</td>
                                        <td>{formatTime(member.startTime)} - {formatTime(member.endTime)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p>Geen roosterinformatie beschikbaar voor dit evenement.</p>
                    )}
                </div>

                <div className="modal-actions">
                    {isRegistered ? (
                        <button onClick={() => onUnregister(event.resource.id)} className="nav-button-secondary" disabled={loading}>
                            {loading ? 'Bezig...' : 'Uitschrijven'}
                        </button>
                    ) : (
                        <button onClick={handleRegister} className="nav-button" disabled={loading || (selectedDays.length === 0)}>
                            {loading ? 'Bezig...' : 'Inschrijven'}
                        </button>
                    )}
                    <button onClick={onClose} disabled={loading}>Sluiten</button>
                </div>
            </div>
        </div>
    );
}

export default EventModal;
