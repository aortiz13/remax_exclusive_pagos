# 🚀 Migración Supabase Cloud → Self-Hosted (EasyPanel)

## Pre-requisitos

- [ ] Acceso SSH al servidor EasyPanel
- [ ] Docker y Docker Compose instalados (EasyPanel ya los tiene)
- [ ] `pg_dump` instalado localmente (`brew install postgresql@15`)
- [ ] Contraseña de la DB de Supabase (Dashboard → Settings → Database)
- [ ] SERVICE_ROLE_KEY de Supabase (Dashboard → Settings → API)
- [ ] Subdominio configurado: `supabase.remax-exclusive.cl` → IP del servidor

---

## Pasos de Migración (en orden)

### Paso 0: Configurar DNS
Crear un registro DNS tipo **A** para `supabase.remax-exclusive.cl` que apunte a la IP de tu servidor EasyPanel.

### Paso 1: Generar JWT Keys (local)
```bash
chmod +x 01-generate-jwt-keys.sh
./01-generate-jwt-keys.sh
```
Guardá las keys generadas.

### Paso 2: Configurar el servidor
1. Copiar `docker-compose.yml` y `.env.example` al servidor
2. Renombrar `.env.example` → `.env`
3. Completar los valores en `.env` con las keys del Paso 1
4. También necesitás copiar los archivos de configuración de Kong y las init scripts de la DB (del repo oficial de Supabase: `supabase/docker/volumes/`)

```bash
# En el servidor:
git clone --depth 1 https://github.com/supabase/supabase /tmp/supabase-repo
cp -r /tmp/supabase-repo/docker/volumes ./volumes
cp docker-compose.yml ./
cp .env ./
docker compose up -d
```

### Paso 3: Exportar la DB (local)
```bash
chmod +x 02-dump-database.sh
./02-dump-database.sh
```
Esto genera 3 archivos dump.

### Paso 4: Subir dumps al servidor
```bash
scp supabase_full_backup.dump supabase_auth_data.dump supabase_storage_metadata.dump usuario@IP_SERVIDOR:/ruta/supabase/
```

### Paso 5: Restaurar la DB (en el servidor)
```bash
chmod +x 03-restore-database.sh
POSTGRES_PASSWORD=tu_password ./03-restore-database.sh
```

### Paso 6: Descargar archivos de Storage (local)
```bash
chmod +x 04-download-storage.sh
# Editá el SERVICE_ROLE_KEY dentro del script primero
./04-download-storage.sh
```

### Paso 7: Subir archivos de Storage al servidor
```bash
scp -r storage_backup/ usuario@IP_SERVIDOR:/ruta/supabase/volumes/storage/
```

### Paso 8: Actualizar Cron Jobs (en el servidor)
```bash
# Editá 05-update-cron-jobs.sql y reemplazá TU_NUEVA_URL
psql -h localhost -U postgres -d postgres -f 05-update-cron-jobs.sql
```

### Paso 9: Deploy Edge Functions
Las edge functions se copian a `./volumes/functions/` en el servidor. Copiar las funciones del directorio `supabase/functions/` del proyecto.

### Paso 10: Actualizar el Frontend
En `src/services/supabase.js`, cambiar:
```js
const supabaseUrl = 'https://supabase.remax-exclusive.cl'
const supabaseKey = 'TU_NUEVA_ANON_KEY'
```

### Paso 11: Re-deploy de la App
Hacer un nuevo build y deploy de la app en EasyPanel con los nuevos valores.

### Paso 12: Verificar
- [ ] Login funciona
- [ ] Tablas tienen datos
- [ ] Storage/archivos se ven
- [ ] Edge functions responden
- [ ] Cron jobs ejecutan
- [ ] Emails se envían

---

## Archivos en este directorio

| Archivo | Dónde ejecutar | Descripción |
|---|---|---|
| `01-generate-jwt-keys.sh` | Local (Mac) | Genera JWT secret y API keys |
| `02-dump-database.sh` | Local (Mac) | Exporta toda la DB de Supabase Cloud |
| `03-restore-database.sh` | Servidor | Restaura la DB en self-hosted |
| `04-download-storage.sh` | Local (Mac) | Descarga archivos de Storage |
| `05-update-cron-jobs.sql` | Servidor | Actualiza URLs de cron jobs |
| `docker-compose.yml` | Servidor | Stack completo de Supabase |
| `.env.example` | Servidor | Template de variables de entorno |
