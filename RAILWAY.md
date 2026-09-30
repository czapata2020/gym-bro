# Despliegue en Railway

Esta guia despliega openGym como dos servicios Railway dentro del mismo proyecto:

```text
Internet -> web (nginx) -> api.railway.internal -> api -> /data
```

Solo `web` debe tener dominio publico. El navegador usa un unico origen y nginx envia `/api/*`
al servicio privado `api`, igual que en `docker-compose.yml`.

## Requisitos

- El repositorio debe estar disponible en GitHub y conectado a Railway.
- Los dos servicios deben usar la misma branch y el mismo environment de Railway.
- El nombre del servicio de backend debe ser `api`, o `BACKEND` debe apuntar a su dominio privado.
- Debe existir un dominio HTTPS definitivo para configurar WebAuthn.

Railway no ejecuta `docker-compose.yml` directamente. Cada entrada de Compose se configura como
un servicio independiente, la red privada sustituye a la red de Compose y un Railway Volume
sustituye al bind mount `./data:/data`.

## 1. Crear los servicios

Crea un proyecto vacio y agrega dos servicios desde este mismo repositorio.

### Servicio `api`

En **Settings** configura:

| Campo | Valor |
| --- | --- |
| Service name | `api` |
| Root Directory | `/api` |
| Healthcheck Path | `/api/health` |

Con `/api` como raiz, Railway detecta `api/Dockerfile` y lo construye con el contexto correcto.
No generes un dominio publico para este servicio.

En **Variables**, define como minimo:

```dotenv
PORT=3000
DATA_DIR=/data
RP_ID=gym.example.com
ORIGIN=https://gym.example.com
RP_NAME=Gym Bro
TRUST_PROXY=1
```

`RP_ID` es solo el hostname, sin protocolo ni ruta. `ORIGIN` debe coincidir exactamente con el
origen HTTPS del servicio `web`. Las demas opciones de `.env.example` (`ADMIN_UIDS`,
`INVITE_ONLY`, `ALLOW_GUEST`, `PASSWORD_LOGIN`, limites de media, etc.) se pueden agregar sin
cambios.

`TRUST_PROXY=1` es apropiado mientras `api` no tenga dominio publico y todo el trafico llegue por
`web`, que reemplaza `X-Forwarded-For` y `X-Real-IP` antes de reenviar la solicitud.

### Servicio `web`

En **Settings** configura:

| Campo | Valor |
| --- | --- |
| Service name | `web` |
| Root Directory | `/` (o dejar vacio) |
| Dockerfile Path | `/web/Dockerfile` |
| Healthcheck Path | `/` |

El contexto debe ser la raiz porque el build web usa `frontend/` y `api/coach/core/`.

En **Variables**, define:

```dotenv
BACKEND=${{api.RAILWAY_PRIVATE_DOMAIN}}
API_PORT=${{api.PORT}}
```

No definas `NGINX_PORT`: el contenedor hace que nginx escuche en el `PORT` que Railway inyecta.
El resolver DNS se obtiene de `/etc/resolv.conf`, por lo que nginx puede resolver y volver a
resolver el dominio privado cuando se reemplaza una instancia de `api`. Si el servicio se renombra,
la referencia de `BACKEND` se actualiza a traves de Railway.

Genera un dominio publico solo para `web`. Railway termina TLS y la comunicacion `web` -> `api`
usa HTTP dentro de la red privada.

## 2. Persistencia

Adjunta un Railway Volume al servicio `api` con mount path exacto:

```text
/data
```

No montes el volumen en `/app/data`: la API usa la ruta absoluta indicada por `DATA_DIR`. El
volumen conserva `db.json`, estados por usuario, el secreto de sesiones, claves VAPID, auditoria,
configuracion del Coach y uploads. Configura backups del volumen desde Railway.

La API basada en archivos debe mantenerse en **una replica**. Railway tampoco solapa dos
deployments de un servicio con volumen, por lo que un redeploy de `api` puede tener una pausa
breve aunque exista health check.

## 3. Orden del primer despliegue

1. Despliega `api` con el volumen `/data` y confirma que `/api/health` responde dentro de Railway.
2. Despliega `web` con `BACKEND` y `API_PORT` referenciando a `api`.
3. Genera o conecta el dominio HTTPS de `web`.
4. Ajusta `RP_ID` y `ORIGIN` en `api` al dominio definitivo y vuelve a desplegar `api`.
5. Abre `https://<dominio>/api/health`; debe responder JSON desde la API a traves de nginx.
6. Crea un perfil, recarga la pagina y confirma que la sesion y los datos sobreviven a un
   redeploy manual de `api`.

## 4. Media de ejercicios

El servicio auxiliar `media` de `docker-compose.yml` descarga recursos de terceros a dos bind
mounts compartidos con `web`. Los Railway Volumes pertenecen a un servicio y no equivalen a esos
bind mounts compartidos. El despliegue base de dos servicios no ejecuta ese inicializador: la app,
autenticacion, sincronizacion y uploads funcionan, pero las imagenes y GIF de ejercicios no estaran
disponibles hasta definir una estrategia de media compatible con sus terminos de licencia.

No se deben incorporar esos archivos a la imagen ni al repositorio sin revisar `NOTICE.md`. Esta
limitacion es independiente del volumen `/data`, que si contiene los uploads privados de ejercicios
personalizados.

## Variables de red

| Variable | Servicio | Uso |
| --- | --- | --- |
| `PORT` | `api` | Puerto de escucha de Node; se fija en `3000` para la red privada. |
| `PORT` | `web` | Inyectado por Railway; nginx escucha en este puerto. |
| `BACKEND` | `web` | Dominio privado del servicio `api`. |
| `API_PORT` | `web` | Puerto interno de `api`; referencia `${{api.PORT}}`. |
| `RESOLVER` | `web` | Opcional; `auto` descubre el resolver del contenedor. |
| `DATA_DIR` | `api` | Debe ser `/data`, igual que el mount path del volumen. |

## Diagnostico rapido

- `web` devuelve `502`: verifica `BACKEND`, `API_PORT`, que ambos servicios esten en el mismo
  environment y que `api` no este reiniciando por permisos o falta del volumen.
- El health check de `web` consulta el puerto equivocado: elimina `NGINX_PORT`; Railway debe
  inyectar `PORT` y el script de entrada lo traslada a nginx.
- Registro o login devuelve `403`: `ORIGIN` no coincide exactamente con la URL publica de `web`.
- Las passkeys fallan: confirma HTTPS y que `RP_ID` sea el hostname de `ORIGIN`.
- Los datos desaparecen tras redeploy: confirma que el volumen esta adjunto a `api` en `/data` y
  que `DATA_DIR=/data`.

## Alcance

Estos cambios no modifican rutas, autenticacion, sincronizacion, modelo de datos ni interfaz de
openGym. Tampoco implementan Challenges. El siguiente modulo debe comenzar solo despues de validar
el build, la red privada, los health checks y la persistencia descritos arriba.
