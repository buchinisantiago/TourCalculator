# TourCalculator 🚀

Sistema profesional de cotización de tours para agentes.

## Características
- 📊 Calculadora dinámica de precios (Bus, Guía, Venues).
- 🛠️ Panel de Administración seguro para editar tarifas y tours.
- ☁️ Integración con Supabase para persistencia de datos.
- 🔄 Script automático de Keep-Alive para evitar que la base de datos se pause.

## Despliegue (Render / Netlify)
1. Conectar este repositorio a Render (opción Static Site).
2. **Build Command**: Vacío.
3. **Publish Directory**: `.` (raíz).

## Configuración de Keep-Alive
Para que Supabase no se apague por inactividad, configurar en GitHub (`Settings > Secrets > Actions`):
- `SUPABASE_URL`: Tu URL de proyecto.
- `SUPABASE_ANON_KEY`: Tu clave anon.

---
*Desarrollado con ❤️ para Buchini Santiago.*
