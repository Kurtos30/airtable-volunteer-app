import React, { useState, useEffect } from 'react';
import Airtable from 'airtable';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import nl from 'date-fns/locale/nl';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '../App.css';
import EventModal from '../components/EventModal';
import { Link } from 'react-router-dom';

const locales = {
  'nl': nl,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const base = new Airtable({
  apiKey: process.env.REACT_APP_AIRTABLE_API_KEY
}).base(process.env.REACT_APP_AIRTABLE_BASE_ID);

function CalendarPage({ user, onUserUpdate }) {
  const [agendaItems, setAgendaItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => {
    const fetchAgendaItems = async () => {
      try {
        console.log('Fetching events from table:', process.env.REACT_APP_AIRTABLE_TABLE_NAME);
        
        const records = await base(process.env.REACT_APP_AIRTABLE_TABLE_NAME)
          .select()
          .all();
        
        console.log('Raw records from Airtable:', records);
        
        const items = records.map(record => ({
          id: record.id,
          ...record.fields
        }));
        
        console.log('Processed items:', items);
        
        // Check what fields are available
        if (items.length > 0) {
          const availableFields = Object.keys(items[0]);
          console.log('Available fields in table:', availableFields);
          
          // Check which events have valid date fields
          const eventsWithValidDates = items.filter(item => {
            const startDate = item['Evenement Start datum'] || item['Start datum'] || item['Start Date'] || item['Start'];
            const endDate = item['Evenement Eind datum'] || item['Eind datum'] || item['End Date'] || item['End'];
            const startDateAlt = item['A Start datum'] || item['A Start'] || item['Start A'];
            const endDateAlt = item['A Eind datum'] || item['A Eind'] || item['End A'];
            return (startDate && endDate) || (startDateAlt && endDateAlt);
          });
          
          setDebugInfo({
            totalRecords: records.length,
            availableFields: availableFields,
            sampleRecord: items[0],
            eventsWithValidDates: eventsWithValidDates.length,
            eventsWithoutValidDates: items.length - eventsWithValidDates.length
          });
        }
        
        const events = items.map(item => {
          // Try multiple field name combinations, EXACTLY the same as AdminAddEventPage
          const eventTitle = item.Evenement || item['Event'] || item['Naam'] || 'Onbekend evenement';
          
          // Try different date field combinations - EXACTLY the same as AdminAddEventPage
          const startDate = item['Evenement Start datum'] || item['Start datum'] || item['Start Date'] || item['Start'];
          const endDate = item['Evenement Eind datum'] || item['Eind datum'] || item['End Date'] || item['End'];
          
          // Also try the new date fields you added to Airtable
          const startDateAlt = item['A Start datum'] || item['A Start'] || item['Start A'];
          const endDateAlt = item['A Eind datum'] || item['A Eind'] || item['End A'];
          
          const event = {
            title: eventTitle,
            start: startDate ? new Date(startDate) : (startDateAlt ? new Date(startDateAlt) : null),
            end: endDate ? new Date(endDate) : (endDateAlt ? new Date(endDateAlt) : null),
            allDay: true,
            resource: item, 
          };
          console.log('Processed event:', event);
          console.log('Event title:', eventTitle);
          console.log('Start date found:', startDate || startDateAlt);
          console.log('End date found:', endDate || endDateAlt);
          return event;
        }).filter(event => {
          const hasValidDates = event.start && event.end;
          if (!hasValidDates) {
            console.log('Filtered out event due to invalid dates:', event);
            console.log('Event title:', event.title);
            console.log('Start date:', event.start);
            console.log('End date:', event.end);
          }
          return hasValidDates;
        });

        console.log('Final events for calendar:', events);
        setAgendaItems(events);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching agenda items:', err);
        setError('Er is een fout opgetreden bij het ophalen van de agenda items.');
        setLoading(false);
      }
    };

    fetchAgendaItems();
  }, []);

  const handleRegister = async (registrationData) => {
    setActionLoading(true);
    
    // Check if this is a multi-day registration or single event
    const isMultiDayRegistration = typeof registrationData === 'object' && registrationData.selectedDays;
    
    if (isMultiDayRegistration) {
      // Multi-day event registration - use separate registrations table
      const { eventId, selectedDays } = registrationData;
      const currentRegistrations = user['Opgegeven Evenementen'] || [];
      
      // Check if user is already registered for this event
      const existingRegistrationIndex = currentRegistrations.findIndex(reg => reg === eventId);
      
      let newRegistrations;
      if (existingRegistrationIndex >= 0) {
        // Update existing registration - just keep the event ID
        newRegistrations = [...currentRegistrations];
      } else {
        // Add new registration - just the event ID
        newRegistrations = [...currentRegistrations, eventId];
      }

      try {
        // First, update the Opgegeven Evenementen field for backward compatibility
        const updatedRecord = await base(process.env.REACT_APP_AIRTABLE_VOLUNTEERS_TABLE_NAME).update(user.id, {
          'Opgegeven Evenementen': newRegistrations,
        });

        // Then, create a detailed registration record in a separate table
        // Note: You'll need to create a "Registrations" table in Airtable with these fields:
        // - Volunteer (Link to Vrijwilligers)
        // - Event (Link to Events) 
        // - Selected Days (Long text)
        // - Registration Date (Date)
        
        try {
          await base('Registrations').create([
            {
              fields: {
                'Volunteer': [user.id],
                'Event': [eventId],
                'Selected Days': selectedDays.join(', '),
                'Registration Date': new Date().toISOString().split('T')[0]
              }
            }
          ]);
        } catch (regErr) {
          console.warn('Could not create detailed registration record:', regErr);
          // Continue anyway - the basic registration is still saved
        }

        onUserUpdate({ id: user.id, ...updatedRecord.fields });
        setSelectedEvent(null);
      } catch (err) {
        console.error('Registration error:', err);
        setError('Fout bij het inschrijven.');
      }
    } else {
      // Single day event registration (existing logic)
      const currentRegistrations = user['Opgegeven Evenementen'] || [];
      const newRegistrations = [...currentRegistrations, registrationData];

      try {
        const updatedRecord = await base(process.env.REACT_APP_AIRTABLE_VOLUNTEERS_TABLE_NAME).update(user.id, {
          'Opgegeven Evenementen': newRegistrations,
        });
        onUserUpdate({ id: user.id, ...updatedRecord.fields });
        setSelectedEvent(null);
      } catch (err) {
        console.error('Registration error:', err);
        setError('Fout bij het inschrijven.');
      }
    }
    setActionLoading(false);
  };

  const handleUnregister = async (eventId) => {
    setActionLoading(true);
    const currentRegistrations = user['Opgegeven Evenementen'] || [];
    
    // Filter out the event ID
    const newRegistrations = currentRegistrations.filter(reg => reg !== eventId);
    
    try {
      const updatedRecord = await base(process.env.REACT_APP_AIRTABLE_VOLUNTEERS_TABLE_NAME).update(user.id, {
        'Opgegeven Evenementen': newRegistrations,
      });
      onUserUpdate({ id: user.id, ...updatedRecord.fields });
      setSelectedEvent(null);
    } catch (err) {
      console.error('Unregistration error:', err);
      setError('Fout bij het uitschrijven.');
    }
    setActionLoading(false);
  };

  if (loading) return <div>Laden...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="App calendar-page">
      {/* Admin Navigation */}
      {user && user.isAdmin && (
        <div className="admin-navigation">
          <Link to="/admin" className="nav-button">🏠 Admin Dashboard</Link>
          <Link to="/admin/add-event" className="nav-button">➕ Nieuw evenement</Link>
          <Link to="/admin/events" className="nav-button">📋 Alle evenementen</Link>
          <Link to="/admin/rooster" className="nav-button">🗂️ Team rooster</Link>
        </div>
      )}
      
      <h1>Evenementen Kalender</h1>
      <p>
        Welkom, {user.Roepnaam}! Klik op een evenement voor details en om je in te schrijven.
        {user.isAdmin && (
          <span className="admin-hint">
            💡 Als admin kun je evenementen toevoegen via de knoppen hierboven.
          </span>
        )}
      </p>

      {/* Debug Info for Admins */}
      {user && user.isAdmin && debugInfo && (
        <div className="debug-info">
          <div className="debug-header">
            <strong>Debug: Evenementen Tabel Info</strong>
          </div>
          
          <div className="debug-section">
            <strong>Totaal records in tabel:</strong> {debugInfo.totalRecords}
          </div>
          
          <div className="debug-section">
            <strong>Beschikbare velden ({debugInfo.availableFields.length}):</strong>
            <div className="field-list">
              {debugInfo.availableFields.map((field, index) => (
                <span key={index} className="field-tag">
                  "{field}"
                </span>
              ))}
            </div>
          </div>
          
          <div className="debug-section">
            <strong>Voorbeeld record:</strong>
            <pre className="sample-record">
              {JSON.stringify(debugInfo.sampleRecord, null, 2)}
            </pre>
          </div>
          
          <div>
            <strong>Evenementen gevonden voor kalender:</strong> {agendaItems.length}
            {agendaItems.length === 0 && (
              <div className="error-message">
                ⚠️ Geen evenementen gevonden! Controleer de veldnamen in je Airtable tabel.
              </div>
            )}
          </div>
          
          <div className="events-analysis">
            <strong>Evenementen analyse:</strong>
            <div>• Evenementen met geldige datums: {debugInfo.eventsWithValidDates}</div>
            <div>• Evenementen zonder geldige datums: {debugInfo.eventsWithoutValidDates}</div>
            {debugInfo.eventsWithoutValidDates > 0 && (
              <div className="error-message">
                ⚠️ {debugInfo.eventsWithoutValidDates} evenement(en) hebben geen geldige start- of einddatum velden.
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="calendar-container">
        <Calendar
          localizer={localizer}
          events={agendaItems}
          onSelectEvent={event => setSelectedEvent(event)}
          startAccessor="start"
          endAccessor="end"
          culture='nl'
          messages={{
            next: "Volgende",
            previous: "Vorige",
            today: "Vandaag",
            month: "Maand",
            week: "Week",
            day: "Dag",
            agenda: "Agenda",
            date: "Datum",
            time: "Tijd",
            event: "Evenement",
          }}
        />
      </div>
      
      <EventModal 
        event={selectedEvent}
        user={user}
        onClose={() => setSelectedEvent(null)}
        onRegister={handleRegister}
        onUnregister={handleUnregister}
        loading={actionLoading}
      />
    </div>
  );
}

export default CalendarPage;
