# Servidor Icecast propio de Altos FM
FROM alpine:3.20

RUN apk add --no-cache icecast gettext \
 && mkdir -p /var/log/icecast \
 && chown -R icecast:icecast /var/log/icecast

COPY icecast.xml.template /etc/icecast/icecast.xml.template
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["/entrypoint.sh"]
