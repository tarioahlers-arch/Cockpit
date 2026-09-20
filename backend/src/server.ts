import { createServer } from "http";
import { app } from "./app";
import { env } from "./config/env";
import { initChatGateway } from "./realtime/chatGateway";

const httpServer = createServer(app);
initChatGateway(httpServer);

httpServer.listen(env.port, () => {
  console.log(`[HelferHand] API laeuft auf http://localhost:${env.port}`);
});
