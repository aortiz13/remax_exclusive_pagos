---
trigger: always_on
---

Para acceder a la base de datos, usa psql directo:
postgres://postgres:5a58ca9a00e2837be764@panel.remax-exclusive.cl:5432/postgres?sslmode=disable

Ejemplo:
node -e "const {Client}=require('pg'); const c=new Client('postgres://postgres:5a58ca9a00e2837be764@panel.remax-exclusive.cl:5432/postgres?sslmode=disable'); c.connect().then(()=>c.query('TU_QUERY')).then(r=>{console.log(JSON.stringify(r.rows,null,2));c.end()}).catch(e=>{console.error(e.message);c.end()})"
