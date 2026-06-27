import { createBotApp } from './app.mjs';

const app = await createBotApp();

app.server.listen(app.config.port, app.config.host, () => {
  console.log(
    `ALLONAHUB bot platform listening on http://${app.config.host}:${app.config.port}`
  );
  console.log(
    `Knowledge chunks: ${app.knowledgeBase.documents.length}, missing sources: ${app.knowledgeBase.missing.length}`
  );
});
