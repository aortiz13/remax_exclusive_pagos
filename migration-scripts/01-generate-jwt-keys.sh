#!/bin/bash
# ============================================
# Script 1: Generar JWT Keys para Supabase Self-Hosted
# ============================================
# Este script genera las claves JWT necesarias para Supabase.
# Ejecutar LOCALMENTE en tu Mac.

set -e

# JWT Secret (al menos 32 caracteres)
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n/+=')

echo "============================================"
echo "  Supabase Self-Hosted - JWT Keys"
echo "============================================"
echo ""
echo "JWT_SECRET=${JWT_SECRET}"
echo ""
echo "Ahora necesitás generar las API keys."
echo "Andá a: https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys"
echo "O usá el siguiente comando con Node.js:"
echo ""
echo "---"
echo "Ejecutá estos comandos para generar ANON_KEY y SERVICE_ROLE_KEY:"
echo ""

cat << 'NODEEOF'
node -e "
const crypto = require('crypto');
const JWT_SECRET = process.argv[1];

function generateJWT(payload, secret) {
  const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(header+'.'+body).digest('base64url');
  return header+'.'+body+'.'+signature;
}

const now = Math.floor(Date.now()/1000);
const anon = generateJWT({role:'anon',iss:'supabase',iat:now,exp:now+315360000}, JWT_SECRET);
const service = generateJWT({role:'service_role',iss:'supabase',iat:now,exp:now+315360000}, JWT_SECRET);

console.log('ANON_KEY=' + anon);
console.log('SERVICE_ROLE_KEY=' + service);
" "$JWT_SECRET"
NODEEOF

echo ""
echo "Copiá el JWT_SECRET y las keys generadas al archivo .env"
