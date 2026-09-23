import { createApp } from './server';

createApp().then(app => {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => console.log(`Server running on http://localhost:${port}`));
}).catch(error => { console.error(error); process.exitCode = 1; });
