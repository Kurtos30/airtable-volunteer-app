# Airtable Setup for Multi-Day Registrations

To enable multi-day event registrations, you need to create a new table in your Airtable base.

## Step 1: Create the Registrations Table

1. Go to your Airtable base
2. Click the "+" button to add a new table
3. Name it "Registrations"

## Step 2: Add the Required Fields

Create these fields in the Registrations table:

| Field Name | Field Type | Description |
|------------|------------|-------------|
| Volunteer | Link to another record | Link to the Vrijwilligers table |
| Event | Link to another record | Link to your Events table |
| Selected Days | Long text | Comma-separated list of selected days (e.g., "2025-07-04, 2025-07-05") |
| Registration Date | Date | When the registration was made |

## Step 3: Configure Field Settings

- **Volunteer**: Set to link to your Vrijwilligers table
- **Event**: Set to link to your Events table  
- **Selected Days**: Set as Long text field
- **Registration Date**: Set as Date field

## How It Works

1. When a user registers for a multi-day event, the app will:
   - Store the event ID in the existing `Opgegeven Evenementen` field (for backward compatibility)
   - Create a detailed record in the new `Registrations` table with the selected days

2. This approach allows you to:
   - Keep existing functionality working
   - Store detailed multi-day information
   - Query registrations by volunteer, event, or date
   - Generate reports on attendance

## Alternative Options

If you prefer not to create a new table, you can also:

### Option 2: Use a Notes/Comments Field
- Add a "Registration Notes" field to the Vrijwilligers table
- Store multi-day information as text in this field
- Less structured but simpler to implement

### Option 3: Use Formula Fields
- Create formula fields in the Events table to calculate attendance
- More complex but keeps everything in existing tables

The separate Registrations table is recommended as it provides the most flexibility and data integrity. 