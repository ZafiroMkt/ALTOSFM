# Servidor de streaming propio de Altos FM (sin Zeno)

Con esto Altos FM tiene **su propio enlace de transmisión**:

```
https://stream.altosfm.com/radio
```

Es un servidor **Icecast** (el mismo software que usan Zeno, AzuraCast y la
mayoría de las radios en línea) más **Caddy**, que le pone HTTPS gratis y
automático. La página web ya está configurada para reproducir ese enlace y
mostrar el nombre de la canción que suena.

```
 Tu PC (BUTT / OBS / Mixxx / RadioBOSS)
        │  envía el audio al puerto 8000
        ▼
 ┌──────────────── Servidor (VPS) ────────────────┐
 │  Icecast :8000  ◄──  Caddy :443 (HTTPS)         │
 └─────────────────────────────────────────────────┘
        │  https://stream.altosfm.com/radio
        ▼
 altosfm.com, app, Radio Garden, TuneIn, etc.
```

---

## 1. Consigue un servidor (VPS)

GitHub Pages solo sirve archivos; **no puede transmitir audio en vivo**, por eso
se necesita un servidor pequeño encendido 24/7. Cualquiera con Ubuntu sirve:

| Proveedor | Costo aprox. | Nota |
|---|---|---|
| Oracle Cloud "Always Free" | Gratis | Hay que abrir puertos en la "Security List" |
| Hetzner CX22 | ~4 €/mes | Mucho ancho de banda incluido (20 TB) |
| DigitalOcean / Vultr / Contabo | 4–6 $/mes | |

Cálculo de consumo: a 128 kbps cada oyente usa ~58 MB por hora.
100 oyentes simultáneos ≈ 13 Mbps.

## 2. Apunta el subdominio al servidor

En el panel donde administras el dominio **altosfm.com**, crea un registro DNS:

| Tipo | Nombre | Valor |
|---|---|---|
| A | `stream` | IP pública del VPS |

> Si usas Cloudflare, deja la nube **gris** (solo DNS). El proxy naranja corta
> las conexiones largas de audio.

## 3. Instala y arranca el servidor

Conéctate al VPS por SSH y ejecuta:

```bash
curl -fsSL https://get.docker.com | sh
```

```bash
git clone https://github.com/zafiromkt/altosfm.git
```

```bash
cd altosfm/streaming-server && cp .env.example .env && nano .env
```

En `.env` **cambia las dos contraseñas** (guárdalas; son las que usarás para
transmitir y para entrar al panel). Luego:

```bash
docker compose up -d --build
```

Abre los puertos **80, 443 y 8000** en el firewall del VPS (en Oracle Cloud,
también en la Security List):

```bash
sudo ufw allow 80,443,8000/tcp
```

Prueba en el navegador: `https://stream.altosfm.com` debe mostrar la página de
estado de Icecast. El certificado HTTPS se genera solo en el primer minuto.

## 4. Transmite desde tu PC

Configura tu programa de transmisión con estos datos:

| Campo | Valor |
|---|---|
| Tipo de servidor | **Icecast** |
| Dirección / Host | `stream.altosfm.com` |
| Puerto | `8000` |
| Montaje (mount) | `/radio` (en BUTT se escribe `radio`) |
| Usuario | `source` |
| Contraseña | la de `ICECAST_SOURCE_PASSWORD` |
| Formato | MP3, 128 kbps, 44100 Hz, estéreo |

**BUTT** (gratis, recomendado): *Settings → Main → Server → ADD* y llena los
datos de arriba. En *Settings → Stream* elige MP3 128 kbps. En *Settings →
Main → Song update* puedes leer el nombre de la canción desde un archivo de
texto que genere tu programa de automatización (Virtual DJ, RadioBOSS,
ZaraRadio…), y así aparece en la web con su portada.

En cuanto pulses ▶ en BUTT, la radio suena en altosfm.com.

## 5. Panel y estadísticas

- Estado público: `https://stream.altosfm.com`
- Administración: `https://stream.altosfm.com/admin/` (usuario `admin`, clave
  `ICECAST_ADMIN_PASSWORD`). Ahí ves oyentes conectados, puedes desconectar la
  fuente o cambiar el título manualmente.

## Mantenimiento

```bash
docker compose logs -f icecast      # ver registros en vivo
docker compose restart              # reiniciar
git pull && docker compose up -d --build   # actualizar
```

## Preguntas frecuentes

**¿Puedo usar otra URL?** Sí. Cambia `STREAM_DOMAIN`/`ICECAST_HOSTNAME` en
`.env`, y en `app.js` (raíz del repo) cambia `STREAM_BASE` y `STREAM_MOUNT`.

**¿Y si mi PC se apaga?** La radio se queda en silencio, igual que pasaba con
Zeno. Para música 24/7 sin la PC se puede agregar un AutoDJ (Liquidsoap o
AzuraCast) en el mismo servidor.

**¿Por qué no se escucha si la web es https y el stream http?** Los navegadores
bloquean audio `http://` dentro de páginas `https://`. Por eso los oyentes
usan `https://stream.altosfm.com/radio` (Caddy) y solo tu programa de
transmisión usa el puerto 8000.
