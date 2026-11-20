# PLAN PLANTA — Supabase y despliegue sin instalar Node

## 1. Ejecutar sin Supabase

Descomprime el ZIP en la Mac y abre `index.html` con Safari o Chrome. Los datos quedan en el navegador. La interfaz, simulaciones, alertas, X-Ray, gráficos y exportación CSV funcionan sin una cuenta Supabase. La librería de Supabase intenta cargarse desde internet pero es opcional.

## 2. Crear tablas en Supabase

1. Abre https://supabase.com y crea un proyecto nuevo.
2. Abre **SQL Editor** > **New query**.
3. Copia **todo** el contenido de `SUPABASE_SCHEMA.sql` y pulsa **Run**.
4. Abre **Authentication** > **Providers** > **Anonymous Sign-Ins** y habilita el acceso anónimo (la ubicación del interruptor puede variar).
5. En **Project Settings** > **API Keys** (o **Connect**), copia **Project URL** y la clave **publishable** (`sb_publishable_...`) o la clave legacy **anon**. **NO** uses secret ni service_role.
6. Edita `config.js` con TextEdit en modo texto plano o con un editor de código y rellena `supabaseUrl` y `supabaseKey` respetando las comillas.
7. Guarda y vuelve a abrir `index.html` con conexión a internet. En **Reportes / Historial** aparecerá el estado de sincronización. Usa **Sincronizar** para subir ciclos que antes eran locales.

Ejemplo en `config.js`:

```js
window.PLAN_PLANTA_CONFIG = {
  supabaseUrl: 'https://TU-PROYECTO.supabase.co',
  supabaseKey: 'sb_publishable_TU_CLAVE_PUBLICA'
};
```

### Cómo se protegen los datos

La app crea un usuario anónimo con **Supabase Auth** y la base de datos usa **Row Level Security (RLS)**. Cada visitante ve únicamente los ciclos y las acciones asociados a su `auth.uid()`. Las sesiones anónimas dependen del navegador: si limpias sus datos, cambias de navegador o dispositivo, podrías perder acceso a los registros de esa sesión aunque sigan en Supabase. Para conservarlos entre dispositivos haría falta implementar inicio de sesión permanente.

## 3. Desplegar gratis (sin Node)

**Opción sencilla: Netlify Drop**

1. Configura `config.js` (si usarás Supabase).
2. Visita https://app.netlify.com/drop/ y arrastra la carpeta `PLAN_PLANTA_MAC` descomprimida (la carpeta que contiene directamente `index.html`).
3. Abre el enlace público generado. Ejecuta una purificación y comprueba que aparece en **Supabase > Table Editor > purification_cycles**.

También puedes subir los archivos tal cual a GitHub Pages o Cloudflare Pages (sitio estático, sin compilación). Si la biblioteca CDN de Supabase está bloqueada, la app seguirá funcionando en modo local. En producción es mejor fijar versiones de dependencias e implementar autenticación permanente si requieres varias cuentas y sincronización entre equipos.

## 4. Acciones por contaminante

- **PM2.5 / PM10:** seleccionar filtro HEPA (no inicia el ciclo automáticamente).
- **CO₂:** seleccionar ventilación; la reducción es una simulación, NO se atribuye al HEPA ni al carbón.
- **CO:** mostrar recomendaciones de seguridad; NO se activa una supuesta purificación que prometa eliminar el riesgo. Un valor real de CO requiere seguir medidas de emergencia y detector certificado.
- Cada clic de **Tomar acción** guarda un registro local y, con Supabase conectado, en `alert_actions`.

## 5. Alcance

Es un proyecto académico: ninguna lectura es de sensor físico, las tasas de filtración son supuestos para demostración, y los umbrales de alerta son didácticos. No usar para tomar decisiones de seguridad o salud ambiental. El botón **Eliminar historial** borra solo datos locales y no borra filas remotas en Supabase; al sincronizar pueden volver a descargarse.
