#!/bin/sh
set -e

# Valores por defecto (cámbialos en el archivo .env)
: "${ICECAST_SOURCE_PASSWORD:?Falta ICECAST_SOURCE_PASSWORD en .env}"
: "${ICECAST_ADMIN_PASSWORD:?Falta ICECAST_ADMIN_PASSWORD en .env}"
: "${ICECAST_RELAY_PASSWORD:=$ICECAST_ADMIN_PASSWORD}"
: "${ICECAST_HOSTNAME:=localhost}"
: "${ICECAST_MAX_CLIENTS:=500}"
: "${ICECAST_MOUNT:=/radio}"
export ICECAST_SOURCE_PASSWORD ICECAST_ADMIN_PASSWORD ICECAST_RELAY_PASSWORD \
       ICECAST_HOSTNAME ICECAST_MAX_CLIENTS ICECAST_MOUNT

envsubst < /etc/icecast/icecast.xml.template > /etc/icecast/icecast.xml
chown icecast:icecast /etc/icecast/icecast.xml

exec icecast -c /etc/icecast/icecast.xml
