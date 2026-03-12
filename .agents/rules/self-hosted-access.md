---
trigger: always_on
---

# Acceso a servicios self-hosted (Easypanel)

- DB: psql postgres://postgres:5a58ca9a00e2837be764@panel.remax-exclusive.cl:5432/postgres?sslmode=disable
- API Gateway: https://remax-crm-remax-app.jzuuqr.easypanel.host
- Storage (MinIO): https://remax-crm-remax-storage.jzuuqr.easypanel.host
- Frontend: https://solicitudes.remax-exclusive.cl
- Backend repo: /Users/adrianortiz/Desktop/miniapp_remax/remax-backend (push a main para deploy)
- Frontend repo: /Users/adrianortiz/Desktop/miniapp_remax/remax-exclusive-requests (push a main para deploy)
- Audit logs: tabla system_audit_logs en la DB
- NO usar Supabase MCP, todo es self-hosted en Easypanel
