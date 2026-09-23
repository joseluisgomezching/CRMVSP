# CRMVSP · VSP Desk 2.0

Migración del proyecto de Google AI Studio a un proyecto Node.js propio. La interfaz funciona sin inicio de sesión de Google. React y Vite sirven la interfaz; Express usa una identidad de servidor para Sheets y Drive. La clave privada no se distribuye al navegador ni debe guardarse en GitHub.

## Ejecutar

1. Requiere Node.js 20 o superior. Instala dependencias con `npm ci`.
2. Activa Google Sheets API y Google Drive API en un proyecto de Google Cloud y crea una cuenta de servicio.
3. Comparte las dos hojas de cálculo y las carpetas de destino con el correo de la cuenta de servicio, con permiso de editor. La opción «Cualquiera con el enlace» por sí sola no autoriza escrituras mediante la API.
4. Guarda el JSON completo de la cuenta de servicio como secreto del servidor `GOOGLE_SERVICE_ACCOUNT_JSON`; alternativamente usa Application Default Credentials. Nunca uses una variable `VITE_` para esta clave. Configura `VITE_PUBLIC_APP_URL` al dominio final para los enlaces de firma y `GEMINI_API_KEY` si usarás la corrección de texto.
5. Ejecuta `npm run dev` en desarrollo. Para producción, `npm run build` y `npm start`. El servidor escucha en el puerto 3000; configura el proxy y TLS en el proveedor de alojamiento.

Las hojas configuradas son la base principal y la de cotizaciones. Las carpetas usadas para fotos, firmas y guías deben admitir las operaciones de Drive de la cuenta de servicio. Para subir archivos, considera una unidad compartida: las cuentas de servicio no tienen cuota propia de almacenamiento en Mi unidad. Ajusta la configuración del proveedor de alojamiento para `supportsAllDrives` si la unidad lo requiere.

## Alcance y decisiones pendientes

- Sin identidad de usuario, los permisos individuales de la antigua hoja `ACCESOS` ya no se aplican; ese menú está oculto. Toda persona con acceso a la URL puede consultar y modificar datos mediante la aplicación. Antes de publicar un CRM con datos personales, limita el acceso al dominio o agrega un sistema de usuarios propio.
- El envío automático desde Gmail no puede funcionar con una cuenta de servicio corriente y no se presenta como envío completado: la acción muestra un error hasta configurar un proveedor de correo en el servidor. El conector Gmail de esta conversación no es una credencial de ejecución de la aplicación.
- No se migraron los datos: las hojas y carpetas actuales continúan siendo la fuente de información. Para desligarse también de Google Sheets/Drive hará falta migrar datos y almacenamiento.
- Las firmas recibidas y los tickets públicos se conservan en `/tmp` según el código original; en alojamiento sin disco persistente necesitas almacenamiento duradero.

## Verificación

`npm run lint` y `npm run build` comprueban tipos y compilación. Una prueba funcional de Sheets/Drive requiere configurar los secretos y permisos indicados arriba. No publiques una clave JSON en este repositorio ni en un enlace de firma.
