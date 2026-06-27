import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createBotApp } from './app.mjs';

const app = await createBotApp();
const rl = readline.createInterface({ input, output });
const conversationId = `cli_${Date.now()}`;

console.log('ALLONAHUB Bot CLI. Cikmak icin "exit" yazin.');

while (true) {
  const message = await rl.question('Siz: ');
  if (['exit', 'quit', 'cikis'].includes(message.trim().toLowerCase())) break;
  const response = await app.orchestrator.handleMessage({
    conversationId,
    channel: 'cli',
    message,
    user: {
      externalUserId: 'local-cli',
      displayName: 'Local CLI'
    }
  });
  console.log(`Bot: ${response.answer}`);
  if (response.ticket) {
    console.log(`Destek kaydi: ${response.ticket.ticketId} (${response.ticket.owner})`);
  }
}

rl.close();
