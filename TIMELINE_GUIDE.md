# How to Connect New Features to the CRM Timeline

When you build something tied to a property or contact, call `logActivity()` so it shows up in their timeline.

## Usage

```javascript
import { logActivity } from '../services/activityService'

await logActivity({
  action: 'Sent Report',                // what happened
  entity_type: 'ManagementReport',       // entity name
  entity_id: report.id,                  // entity UUID
  description: 'Report #12 sent',        // shown in the UI
  details: { pdf_url: '...' },           // extra data (shown in detail modal)
  property_id: report.property_id,       // shows on this property's timeline
  contact_id: report.contact_id,         // shows on this contact's timeline
})
```

## Rules

- Pass `property_id` and/or `contact_id` — without them the event won't appear
- Call **after** the operation succeeds
- Timeline refreshes automatically via Supabase Realtime

## Want a custom icon, color & filter?

Modify these 3 files:

| File | What to add |
|------|-------------|
| `src/services/timelineService.js` | New fetcher function + add it to `Promise.all` in `fetchUnifiedTimeline()` + add entry to `EVENT_TYPES` array |
| `src/components/crm/UnifiedTimeline.jsx` | Entry in `TYPE_CONFIG` (icon, colors, dot) |
| `src/components/crm/TimelineEventModal.jsx` | Entry in `TYPE_HEADERS` + conditional block for type-specific modal fields |
