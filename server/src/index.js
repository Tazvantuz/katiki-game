export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      const id = env.GAME_ROOM.idFromName("global-room");
      const room = env.GAME_ROOM.get(id);
      return room.fetch(request);
    }
    return new Response("Katiki Server is running!", { status: 200 });
  }
};

export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map(); // Храним сессии: WebSocket -> Данные игрока
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    server.accept();
    
    // Генерируем случайный ID для игрока
    const playerId = Math.random().toString(36).substring(2, 9);
    const playerData = { id: playerId, x: 512, y: 384 }; // Стартовая позиция
    this.sessions.set(server, playerData);

    // Отправляем новому игроку его ID и список уже существующих игроков
    const existingPlayers = Array.from(this.sessions.values()).filter(p => p.id !== playerId);
    server.send(JSON.stringify({ type: 'init', id: playerId, players: existingPlayers }));

    // Оповещаем всех остальных, что зашел новый игрок
    this.broadcast({ type: 'player_joined', player: playerData }, server);

    server.addEventListener('message', (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === 'move') {
          const player = this.sessions.get(server);
          if (player) {
            player.x = data.x;
            player.y = data.y;
            // Рассылаем новую позицию всем, кроме отправителя
            this.broadcast({ type: 'player_moved', id: playerId, x: player.x, y: player.y }, server);
          }
        }
      } catch (e) {
        console.error("Ошибка парсинга сообщения", e);
      }
    });

    server.addEventListener('close', () => {
      this.sessions.delete(server);
      // Оповещаем всех, что игрок вышел
      this.broadcast({ type: 'player_left', id: playerId });
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  // Вспомогательная функция для рассылки
  broadcast(message, excludeSession = null) {
    const msgString = JSON.stringify(message);
    this.sessions.forEach((_, session) => {
      if (session !== excludeSession && session.readyState === WebSocket.OPEN) {
        session.send(msgString);
      }
    });
  }
}