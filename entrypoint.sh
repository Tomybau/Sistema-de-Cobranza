#!/bin/sh
set -e

echo "▶ Aplicando migraciones de base de datos..."
node_modules/.bin/prisma migrate deploy --schema=db/schema.prisma

echo "▶ Iniciando servidor..."
exec node server.js
