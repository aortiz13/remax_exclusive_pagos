---
description: Generate a complete video tutorial for a CRM section automatically (recording + script + TTS + video)
---

# Generate Video Tutorial

// turbo-all

This workflow automates the full video tutorial generation pipeline for the Remax Exclusive CRM.

## Prerequisites
- The dev server must be running at `http://localhost:5173`
- Google Cloud TTS secrets should be configured in Supabase Edge Function
- The Remotion project at `remax-exclusive-requests/remotion/` should have dependencies installed

## Usage
Tell me: **"Generate a tutorial for [section name]"** where section name is one of:
- `dashboard` - Dashboard principal
- `crm_contacts` - CRM Contactos & Tareas
- `crm_pipeline` - Pipeline de Ventas
- `calendar` - Calendario
- `casilla` - Casilla de Email
- `action` - Modal de Acciones (modal)
- `task` - Modal de Tareas (modal)
- `camera_360` - Modal Cámara 360° (modal)
- `payment_link` - Formulario Link de Pago
- `contract` - Formulario Contrato de Arriendo
- `mandate` - Formulario Nueva Captación
- `contact` - Formulario de Contacto
- `property` - Formulario de Propiedad
- `create_contact_property` - Flujo completo contacto+propiedad+acción
- `weekly_kpi` - Flujo registro KPIs semanales

## Steps

### 1. Record the Browser Session
Use the `browser_subagent` tool to navigate through the target CRM section. The recording is automatic — the browser_subagent records all interactions as a `.webp` video.

The recording task should follow the steps defined in `src/services/autoScriptGenerator.js` for the selected target.

### 2. Upload Recording to Supabase Storage
Upload the resulting `.webp` recording file to the `tutorial-assets` bucket in Supabase Storage.

### 3. Create Tutorial in Database
Insert a new record in `video_tutorials` with:
- `title`: from the target label
- `target_key`: the target key (e.g., `modal.action`)
- `target_type`: from the target type (e.g., `modal`)
- `recording_url`: the public URL from step 2
- `status`: `draft`

### 4. Insert Auto-Generated Segments
Get the narration segments from `autoScriptGenerator.js` and insert them into `tutorial_segments`.

### 5. Generate TTS Audio
Call the `generate-tts` Supabase Edge Function for each segment to produce audio files with word timestamps.

### 6. Generate Remotion Props
Download the Remotion input props JSON from the admin UI or generate it using `tutorialPipeline.generateRemotionProps()`.

### 7. Render Video with Remotion
```bash
cd remotion && npm install && node render.mjs ../out/props.json ../out/tutorial.mp4
```

### 8. Upload Final Video
Upload the rendered `.mp4` to Supabase Storage and update the tutorial status to `completed`.

### 9. Publish to Aula Virtual (Optional)
Call `tutorialPipeline.publishToAulaVirtual()` to add the video to the virtual classroom.
