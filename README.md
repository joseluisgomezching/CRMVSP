# CRMVSP · VSP Desk 2.0

Migración del proyecto de Google AI Studio a un proyecto Node.js propio. No requiere inicio de sesión con Google: el administrador usa correo y contraseña propios de la aplicación. React y Vite sirven la interfaz; Express usa una identidad de servidor para Sheets y Drive. Ninguna clave privada debe guardarse en GitHub.

## Ejecutar

1. Requiere Node.js 20 o superior. Instala dependencias con `npm ci`.
2. Activa Google Sheets API y Google Drive API en un proyecto de Google Cloud y crea una cuenta de servicio.
3. Si usas cuenta de servicio, comparte las dos hojas de cálculo y las carpetas de destino con su correo, con permiso de editor. La opción «Cualquiera con el enlace» por sí sola no autoriza escrituras mediante la API.
4. Guarda el JSON completo de la cuenta de servicio como secreto del servidor `GOOGLE_SERVICE_ACCOUNT_JSON`; alternativamente usa Application Default Credentials. Si tus carpetas están en Mi unidad y necesitas subir fotos o PDFs, usa las variables `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` y `GOOGLE_OAUTH_REFRESH_TOKEN` de una cuenta propietaria, obtenida una sola vez con consentimiento offline y permisos de Drive y Sheets. Este método tampoco exige login al usuario final. Nunca uses una variable `VITE_` para esta clave. Configura `VITE_PUBLIC_APP_URL` al dominio final para los enlaces de firma y `GEMINI_API_KEY` si usarás la corrección de texto.
5. Configura el correo de la cuenta administradora como secreto `ADMIN_EMAIL`. En una terminal interactiva ejecuta `node scripts/hash-password.cjs`, elige una contraseña de 12 caracteres o más y guarda el valor devuelto como secreto `ADMIN_PASSWORD_HASH`. Genera `SESSION_SECRET` con `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` y guárdalo como secreto del servidor. Para dar de alta empleados, configura `CRM_USERS_FILE` como ruta de un archivo en un volumen persistente con respaldo. No pongas estos valores en el repositorio.
6. Ejecuta `npm run dev` en desarrollo. Para producción, `npm run build` y `npm start`. El servidor escucha en el puerto indicado por `PORT` o, en su defecto, 3000; configura TLS en el proveedor de alojamiento.

**Si el login muestra «Unexpected token ... is not valid JSON»:** la URL abierta sirve la interfaz pero `/api/auth/login` no llega al servidor Express. Abre la URL del proceso `npm run dev` o despliega la app como servicio Node.js con `npm start`; una vista estática o GitHub Pages no ejecuta la API. Comprueba que `/api/auth/me` responda JSON y que `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` y `SESSION_SECRET` estén configurados en el servidor. Subir código a GitHub no crea esas variables ni activa el login.

Las hojas configuradas son la base principal y la de cotizaciones. Las carpetas usadas para fotos, firmas y guías deben admitir las operaciones de Drive de la cuenta de servicio. Para subir archivos mediante cuenta de servicio, usa una unidad compartida: las cuentas de servicio no tienen cuota propia de almacenamiento en Mi unidad. Las carpetas en Mi unidad requieren el token de actualización del propietario. Ajusta la configuración del proveedor de alojamiento para `supportsAllDrives` si la unidad lo requiere.

## Alcance y decisiones pendientes

- El administrador crea usuarios en **Usuarios y permisos**, asigna contraseñas (mínimo 12 caracteres), módulos y estado activo. Las contraseñas de empleados se guardan como hashes scrypt en `CRM_USERS_FILE`, que debe permanecer fuera del repositorio. Cambiar permisos o suspender una cuenta invalida su sesión. Las hojas se autorizan por tabla y los módulos que comparten una tabla pueden leerla; los permisos no filtran filas dentro de una misma hoja.
- Los enlaces de firma enviados a clientes son públicos. Quien conozca un enlace de firma puede enviarla para ese ticket; antes de ampliar el uso a clientes externos conviene añadir enlaces firmados de un solo uso.
- El envío automático desde Gmail no puede funcionar con una cuenta de servicio corriente y no se presenta como envío completado: la acción muestra un error hasta configurar un proveedor de correo en el servidor. El conector Gmail de esta conversación no es una credencial de ejecución de la aplicación.
- No se migraron los datos: las hojas y carpetas actuales continúan siendo la fuente de información. Para desligarse también de Google Sheets/Drive hará falta migrar datos y almacenamiento.
- Las firmas recibidas y los tickets públicos se conservan en `/tmp` según el código original; en alojamiento sin disco persistente necesitas almacenamiento duradero.

## Verificación

`npm run lint` y `npm run build` comprueban tipos y compilación. Una prueba funcional de Sheets/Drive requiere configurar los secretos y permisos indicados arriba. El servidor devuelve 503 mientras falte `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` o `SESSION_SECRET`. No publiques claves en este repositorio ni en un enlace de firma.
