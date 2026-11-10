// Функция для хеширования пароля (SHA-256 с солью)
async function hashPassword(password, salt = 'katiki_salt') {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Заголовки для разрешения кросс-доменных запросов (CORS)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Разрешаем запросы с любых доменов
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type", // Разрешаем заголовок Content-Type
  "Access-Control-Max-Age": "86400", // Кэшируем preflight-запрос на 24 часа
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Обработка предварительного запроса OPTIONS (CORS preflight)
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 2. WebSocket подключение
    if (url.pathname === '/ws') {
      const id = env.GAME_ROOM.idFromName("global-room");
      const room = env.GAME_ROOM.get(id);
      return room.fetch(request);
    }

    // 3. API для регистрации
    if (url.pathname === '/api/register' && request.method === 'POST') {
      try {
        const { username, password } = await request.json();
        if (!username || !password) {
          return new Response(JSON.stringify({ error: 'Введите логин и пароль' }), { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
        const hash = await hashPassword(password);
        const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
        if (existing) {
          return new Response(JSON.stringify({ error: 'Пользователь уже существует' }), { 
            status: 409, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
        await env.DB.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').bind(username, hash).run();
        return new Response(JSON.stringify({ success: true, message: 'Регистрация успешна' }), { 
          status: 201, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Ошибка сервера' }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    // 4. API для входа
    if (url.pathname === '/api/login' && request.method === 'POST') {
      try {
        const { username, password } = await request.json();
        const hash = await hashPassword(password);
        const user = await env.DB.prepare('SELECT id, username FROM users WHERE username = ? AND password_hash = ?').bind(username, hash).first();
        if (user) {
          return new Response(JSON.stringify({ success: true, username: user.username }), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        } else {
          return new Response(JSON.stringify({ error: 'Неверный логин или пароль' }), { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Ошибка сервера' }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    // 5. Базовый ответ для всех остальных запросов
    return new Response("Katiki Server is running!", { 
      status: 200, 
      headers: corsHeaders 
    });
  }
};

export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    server.accept();
    
    const playerId = Math.random().toString(36).substring(2, 9);
    const playerData = { id: playerId, x: 512, y: 384, angle: 0 };
    this.sessions.set(server, playerData);

    const existingPlayers = Array.from(this.sessions.values()).filter(p => p.id !== playerId);
    server.send(JSON.stringify({ type: 'init', id: playerId, players: existingPlayers }));

    this.broadcast({ type: 'player_joined', player: playerData }, server);

    server.addEventListener('message', (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === 'move') {
          const player = this.sessions.get(server);
          if (player) {
            player.x = data.x;
            player.y = data.y;
            player.angle = data.angle;
            this.broadcast({ type: 'player_moved', id: playerId, x: player.x, y: player.y, angle: player.angle }, server);
          }
        }
      } catch (e) {
        console.error("Ошибка парсинга сообщения", e);
      }
    });

    server.addEventListener('close', () => {
      this.sessions.delete(server);
      this.broadcast({ type: 'player_left', id: playerId });
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  broadcast(message, excludeSession = null) {
    const msgString = JSON.stringify(message);
    this.sessions.forEach((_, session) => {
      if (session !== excludeSession && session.readyState === WebSocket.OPEN) {
        session.send(msgString);
      }
    });
  }
}