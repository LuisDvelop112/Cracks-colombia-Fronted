# Cracks Colombia — frontend

Frontend de Cracks Colombia (Vue 3 + Vite). Consume la API de un backend independiente (Spring Boot, por defecto en `http://localhost:8080`).

## Requisitos

- Node 20 o superior
- El backend ejecutándose en otro repositorio/proceso (por defecto `http://localhost:8080`)

## Desarrollo

```bash
npm install
cp .env.example .env   # opcional; ajusta la URL del backend si no usa el puerto 8080
npm run dev            # http://localhost:5173
```

### Conexión con el backend

El backend no tiene CORS configurado, así que el navegador llama a `/api/*` en el servidor de Vite y este reenvía la petición al backend quitando el prefijo `/api`. El destino se cambia con `API_PROXY_TARGET` en `.env`.

```
API_PROXY_TARGET=http://localhost:8080
VITE_API_BASE_URL=/api
```

Para producción hay que habilitar CORS en el backend (o servir ambos detrás del mismo dominio) y definir `VITE_API_BASE_URL` antes de `npm run build`.

## Pantallas

| Ruta | Quién | Pantalla |
| --- | --- | --- |
| `/registro` | Público | Registro con rol, fecha de nacimiento, autorización del acudiente y consentimiento (HU-01) |
| `/login` | Público | Inicio de sesión (HU-01). El deportista sin perfil va a `/perfil/crear` |
| `/perfil/crear` | `DEPORTISTA` | Crear perfil en tres pasos: deporte y posición, datos físicos, trayectoria |
| `/perfil` | `DEPORTISTA` | Editar perfil, con vista previa de cómo lo ven los ojeadores |
| `/deportistas/:athleteId` | Público | Vista pública del perfil; el ojeador marca interés y solicita contacto |
| `/buscar` | `OJEADOR_ENTRENADOR` | Búsqueda con filtros (deporte, posición, edad, departamento) y resultados paginados |
| `/solicitudes` | Ambos | Bandeja: el deportista acepta o rechaza; el ojeador sigue el estado de las enviadas |
| Campana (barra superior) | Ambos | Panel de notificaciones; se consulta cada 60 s |
| `/mis-videos` | `DEPORTISTA` | Carga y galería de videos (HU-03) |

## Notas de implementación

- El token JWT se guarda en `localStorage` y la sesión se cierra sola cuando expira (`exp`) o cuando la API responde 401.
- Antes de subir un video, el navegador valida extensión/tipo, tamaño (50 000 000 bytes) y duración (60 s). El backend sigue siendo quien valida el contenedor, la pista de video y la duración real.
- Los videos aprobados se reproducen directamente desde `GET /videos/{id}/content`. Los pendientes o rechazados requieren el token, que un `<video src>` no puede enviar, así que se descargan con `fetch` y se reproducen desde una URL `blob:` cuando el deportista pide la vista previa.
- La mayoría de edad se calcula en el cliente solo para mostrar la sección del acudiente; el backend la recalcula y tiene la última palabra.
