# Streaming 100% gratis desde la PC del estudio

Sin pagar servidor ni plan: la **PC del estudio** hace de servidor de radio, y
**Cloudflare Tunnel** (gratis) la publica en internet con HTTPS en:

```
https://stream.altosfm.com/radio
```

La página web ya está configurada para reproducir ese enlace.

```
 RocketBroadcaster ──► Icecast (en la misma PC, localhost:8000)
                              │
                       Cloudflare Tunnel (gratis, HTTPS)
                              │
               https://stream.altosfm.com/radio ──► altosfm.com
```

Ventajas: no hay que abrir puertos en el router y no importa si tu IP cambia.

Ten en cuenta:
- La radio suena **solo mientras la PC esté encendida** con todo abierto (igual que antes con Zeno).
- Cada oyente usa la **subida** de internet del estudio: a 128 kbps, 10 oyentes ≈ 1,3 Mbps de subida.
  Si tu subida es baja, transmite a **64 o 96 kbps** en RocketBroadcaster.

---

## Paso 1 – Instala Icecast en la PC (gratis)

1. Descarga el instalador para Windows desde la página oficial: <https://icecast.org/download/>
   (archivo `icecast_win32_2.4.4.exe` o el más reciente).
2. Instálalo con las opciones normales.
3. En la carpeta del repositorio, abre `streaming-pc/icecast.xml`, **cambia las dos
   contraseñas** (`CAMBIA-ESTA-CLAVE-...`) y guárdalo.
4. Copia ese archivo encima del `icecast.xml` de la carpeta donde se instaló Icecast
   (normalmente `C:\Archivos de programa\Icecast` o `C:\Program Files (x86)\Icecast`). Windows pedirá permiso de administrador.
   Importante: usa Icecast **2.4.4** (archivos de 2018). La versión vieja "Icecast2 Win32" de 2005 no sirve.
5. Abre **Icecast** y presiona **Start Server**. Marca la opción para que arranque
   con Windows si la tienes.
6. Comprueba que funciona: abre <http://localhost:8000> en el navegador de la PC.

## Paso 2 – Configura RocketBroadcaster

| Campo | Valor |
|---|---|
| Server Type | **Icecast 2** |
| Hostname | `localhost` |
| Port | `8000` |
| Mount Point | `/radio` |
| Username | `source` |
| Password | la `source-password` que pusiste en `icecast.xml` |
| SSL | desactivado |
| Formato | MP3, 128 kbps (o 64/96 si tu internet es lento), 44100 Hz |

Presiona **Start Streaming**. En <http://localhost:8000> debe aparecer `/radio`.

## Paso 3 – Pasa el dominio a Cloudflare (gratis)

Cloudflare necesita administrar el DNS de `altosfm.com`. Si ya lo usas, salta al Paso 4.

1. Crea una cuenta gratis en <https://dash.cloudflare.com/sign-up>.
2. **Add a domain** → escribe `altosfm.com` → elige el plan **Free**.
3. Cloudflare copia tus registros DNS actuales. Revisa que estén los de la página web
   (GitHub Pages) y los del correo, si tienes.
4. Cloudflare te da **2 nameservers**. Entra donde compraste el dominio y reemplaza los
   nameservers por esos dos. Puede tardar desde minutos hasta unas horas en activarse.

### En Spaceship (donde se compró altosfm.com)

1. **Antes de tocar nada**, en Spaceship abre **Launchpad → Domain Manager → altosfm.com →
   Advanced DNS** y toma captura de todos los registros (A, CNAME, MX, TXT).
2. En Cloudflare compara: los mismos registros deben aparecer en **DNS → Records**.
   Si falta alguno, agrégalo igual. Los de la página web (A / CNAME de `@` y `www`) y los
   del correo (MX / TXT) déjalos con la **nube gris** ("DNS only") si dudas.
3. En Spaceship, en la ficha de altosfm.com, si **DNSSEC** está activado, desactívalo primero.
4. En Spaceship, en **Nameservers**, cambia de "Spaceship nameservers" a **Custom
   nameservers** y pega los 2 que te dio Cloudflare (algo como `xxx.ns.cloudflare.com`). Guarda.
5. Espera el correo de Cloudflare diciendo que el dominio está **Active**.

## Paso 4 – Crea el túnel (gratis)

1. En el panel de Cloudflare ve a **Zero Trust → Networks → Tunnels**
   (en algunas cuentas aparece como **Networks → Tunnels** en el menú principal).
   Si te pide elegir plan de Zero Trust, elige **Free** (0 $).
2. **Create a tunnel** → tipo **Cloudflared** → nombre `altosfm-radio`.
3. Elige **Windows**. Cloudflare te muestra un comando parecido a:
   ```
   cloudflared.exe service install eyJhIjoi...
   ```
   Descarga `cloudflared` desde el enlace que aparece ahí, abre **PowerShell como
   administrador** y pega ese comando. Así el túnel queda instalado como servicio
   y arranca solo con Windows.
4. En **Public Hostname** agrega:
   - Subdomain: `stream`
   - Domain: `altosfm.com`
   - Type: **HTTP**
   - URL: `localhost:8000`
5. Guarda.

## Paso 5 – Prueba

- Abre <https://stream.altosfm.com> desde el celular (con datos, no con el wifi del
  estudio): debe salir la página de estado de Icecast.
- Abre <https://stream.altosfm.com/radio>: debe sonar la radio.
- Abre <https://altosfm.com> y dale ▶.

## Si algo falla

| Problema | Solución |
|---|---|
| RocketBroadcaster no conecta | Icecast debe estar en *Start Server*; usuario `source`; misma clave que `icecast.xml`. |
| stream.altosfm.com da error 502 / 1033 | El túnel o Icecast están apagados en la PC. Revisa que el servicio `cloudflared` esté corriendo. |
| La web dice "no fue posible reproducir la señal" | No se está transmitiendo: revisa que RocketBroadcaster esté en vivo. |
| Se corta o se traba | Baja el bitrate a 64–96 kbps. |

## Panel de administración

En la PC: <http://localhost:8000/admin/> (usuario `admin`, la clave de admin del `icecast.xml`).
Ahí ves cuántos oyentes hay conectados.
