// client/src/scenes/MainScene.js
import Phaser from 'phaser';

export default class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
        this.myId = null;
        this.otherPlayers = {};
        this.myPlayer = null;
        this.ws = null;
        this.speed = 3.5;
        this.lastSendTime = 0;
        this.targetX = null;
        this.targetY = null;
        this.isLoggedIn = false;
        this.currentDir = 'down';
    }

    preload() {
        // Текстур пока нет, генерируем их в create()
    }

    create() {
        this.generateKatikTextures(); // Генерируем спрайты катиков

        if (localStorage.getItem('katiki_username')) {
            this.startGame();
        } else {
            this.showAuthForm();
        }
    }

    generateKatikTextures() {
        const width = 64;
        const height = 64;
        const colors = {
            body: '#F5A623',     // Оранжевый
            belly: '#FFFFFF',    // Белый
            ears: '#E88A1A',     // Темно-оранжевый
            eyes: '#222222',     // Черный
            blush: '#FFB6C1'     // Розовый
        };

        // Функция-помощник для рисования
        const drawKatik = (key, direction) => {
            const canvas = this.textures.createCanvas(key, width, height);
            const ctx = canvas.context;
            ctx.clearRect(0, 0, width, height);

            const cx = width / 2;
            const cy = height / 2;

            // Тень (отрисовываем всегда снизу)
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath();
            ctx.ellipse(cx, cy + 18, 16, 8, 0, 0, Math.PI * 2);
            ctx.fill();

            // Хвост (в зависимости от направления)
            ctx.fillStyle = colors.body;
            ctx.beginPath();
            if (direction === 'left') {
                ctx.ellipse(cx + 12, cy + 5, 12, 6, Math.PI / 4, 0, Math.PI * 2);
            } else if (direction === 'right') {
                ctx.ellipse(cx - 12, cy + 5, 12, 6, -Math.PI / 4, 0, Math.PI * 2);
            } else {
                ctx.ellipse(cx, cy + 10, 6, 12, 0, 0, Math.PI * 2);
            }
            ctx.fill();

            // Тело
            ctx.fillStyle = colors.body;
            ctx.beginPath();
            ctx.ellipse(cx, cy + 8, 16, 14, 0, 0, Math.PI * 2);
            ctx.fill();

            // Живот (если смотрит на нас или в профиль)
            if (direction !== 'up') {
                ctx.fillStyle = colors.belly;
                ctx.beginPath();
                ctx.ellipse(cx, cy + 12, 10, 8, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            // Голова
            ctx.fillStyle = colors.body;
            ctx.beginPath();
            ctx.arc(cx, cy - 6, 18, 0, Math.PI * 2);
            ctx.fill();

            // Уши
            ctx.fillStyle = colors.ears;
            if (direction === 'down' || direction === 'up') {
                // Левое ухо
                ctx.beginPath();
                ctx.moveTo(cx - 14, cy - 18);
                ctx.lineTo(cx - 4, cy - 24);
                ctx.lineTo(cx - 6, cy - 10);
                ctx.fill();
                // Правое ухо
                ctx.beginPath();
                ctx.moveTo(cx + 14, cy - 18);
                ctx.lineTo(cx + 4, cy - 24);
                ctx.lineTo(cx + 6, cy - 10);
                ctx.fill();
            } else if (direction === 'left') {
                ctx.beginPath();
                ctx.moveTo(cx - 2, cy - 20);
                ctx.lineTo(cx - 12, cy - 22);
                ctx.lineTo(cx - 8, cy - 10);
                ctx.fill();
            } else if (direction === 'right') {
                ctx.beginPath();
                ctx.moveTo(cx + 2, cy - 20);
                ctx.lineTo(cx + 12, cy - 22);
                ctx.lineTo(cx + 8, cy - 10);
                ctx.fill();
            }

            // Глаза и мордочка
            if (direction === 'down') {
                // Глаза
                ctx.fillStyle = colors.eyes;
                ctx.beginPath(); ctx.arc(cx - 7, cy - 6, 3, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(cx + 7, cy - 6, 3, 0, Math.PI * 2); ctx.fill();
                // Блики
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath(); ctx.arc(cx - 8, cy - 7, 1, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(cx + 6, cy - 7, 1, 0, Math.PI * 2); ctx.fill();
                // Румянец
                ctx.fillStyle = colors.blush;
                ctx.beginPath(); ctx.ellipse(cx - 11, cy - 2, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(cx + 11, cy - 2, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
                // Носик
                ctx.fillStyle = '#FF8A8A';
                ctx.beginPath();
                ctx.moveTo(cx, cy - 2);
                ctx.lineTo(cx - 2, cy);
                ctx.lineTo(cx + 2, cy);
                ctx.fill();
            } else if (direction === 'left') {
                ctx.fillStyle = colors.eyes;
                ctx.beginPath(); ctx.arc(cx - 8, cy - 6, 3, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath(); ctx.arc(cx - 9, cy - 7, 1, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = colors.blush;
                ctx.beginPath(); ctx.ellipse(cx - 12, cy - 2, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
            } else if (direction === 'right') {
                ctx.fillStyle = colors.eyes;
                ctx.beginPath(); ctx.arc(cx + 8, cy - 6, 3, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath(); ctx.arc(cx + 7, cy - 7, 1, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = colors.blush;
                ctx.beginPath(); ctx.ellipse(cx + 12, cy - 2, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
            }

            canvas.refresh();
        };

        drawKatik('katik_down', 'down');
        drawKatik('katik_up', 'up');
        drawKatik('katik_left', 'left');
        drawKatik('katik_right', 'right');
    }

    showAuthForm() {
        const formHtml = `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;800&display=swap');
                .auth-container {
                    display: flex; width: 800px; height: 480px;
                    background: rgba(255, 255, 255, 0.95); border-radius: 30px;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.3), inset 0 0 0 4px rgba(255,255,255,0.5);
                    overflow: hidden; font-family: 'Nunito', sans-serif;
                    backdrop-filter: blur(10px); animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                }
                @keyframes popIn { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
                .auth-left { flex: 1; padding: 40px; display: flex; flex-direction: column; justify-content: center; background: #ffffff; }
                .auth-right { flex: 1; background: linear-gradient(135deg, #FF9A9E 0%, #FECFEF 99%, #FECFEF 100%); padding: 40px; display: flex; flex-direction: column; color: #333; }
                .auth-title { font-size: 32px; font-weight: 800; color: #333; margin-bottom: 30px; text-align: center; }
                .auth-input { width: 100%; padding: 15px 20px; margin-bottom: 20px; border: 2px solid #E0E0E0; border-radius: 15px; font-size: 16px; font-family: 'Nunito', sans-serif; transition: all 0.3s ease; box-sizing: border-box; outline: none; }
                .auth-input:focus { border-color: #4CAF50; box-shadow: 0 0 10px rgba(76, 175, 80, 0.2); }
                .auth-buttons { display: flex; gap: 15px; margin-top: 10px; }
                .auth-btn { flex: 1; padding: 15px; border: none; border-radius: 15px; font-size: 18px; font-weight: 800; color: white; cursor: pointer; transition: all 0.2s ease; font-family: 'Nunito', sans-serif; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
                .auth-btn:hover { transform: translateY(-3px) scale(1.02); }
                .auth-btn:active { transform: translateY(1px); }
                .btn-login { background: linear-gradient(135deg, #4CAF50, #45a049); }
                .btn-register { background: linear-gradient(135deg, #2196F3, #1976D2); }
                .news-title { font-size: 28px; font-weight: 800; margin-bottom: 20px; text-align: center; }
                .news-item { background: rgba(255,255,255,0.7); padding: 15px; border-radius: 15px; margin-bottom: 15px; font-size: 14px; }
                .news-item b { display: block; font-size: 16px; margin-bottom: 5px; color: #D81B60; }
                .toast-container { position: absolute; top: 20px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 10px; z-index: 9999; }
                .toast { padding: 15px 30px; border-radius: 15px; color: white; font-weight: 800; font-size: 16px; box-shadow: 0 10px 20px rgba(0,0,0,0.2); opacity: 0; transform: translateY(-20px); animation: slideDown 0.3s forwards, fadeOut 0.3s 2.7s forwards; text-align: center; min-width: 250px; }
                .toast.success { background: linear-gradient(135deg, #4CAF50, #45a049); }
                .toast.error { background: linear-gradient(135deg, #F44336, #D32F2F); }
                @keyframes slideDown { to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeOut { to { opacity: 0; transform: translateY(-20px); } }
            </style>
            <div class="toast-container" id="toast-box"></div>
            <div class="auth-container">
                <div class="auth-left">
                    <div class="auth-title">Вход в Катики</div>
                    <input type="text" id="username" class="auth-input" placeholder="Твой логин">
                    <input type="password" id="password" class="auth-input" placeholder="Твой пароль">
                    <div class="auth-buttons">
                        <button id="loginBtn" class="auth-btn btn-login">Войти</button>
                        <button id="registerBtn" class="auth-btn btn-register">Регистрация</button>
                    </div>
                </div>
                <div class="auth-right">
                    <div class="news-title">📢 Новости</div>
                    <div class="news-item"><b>Добро пожаловать!</b>Мы рады видеть тебя в мире Катиков. Создай своего персонажа и исследуй город!</div>
                    <div class="news-item"><b>Скоро обновление!</b>Совсем скоро мы добавим новые домики, магазины и мини-игры. Следи за новостями!</div>
                </div>
            </div>
        `;

        const form = this.add.dom(512, 384).createFromHTML(formHtml);

        const showToast = (message, type = 'success') => {
            const toastBox = form.getChildByID('toast-box');
            if (!toastBox) return;
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.innerText = message;
            toastBox.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        };

        const loginBtn = form.getChildByID('loginBtn');
        const registerBtn = form.getChildByID('registerBtn');

        registerBtn.addEventListener('click', async () => {
            const username = form.getChildByID('username').value;
            const password = form.getChildByID('password').value;
            if (!username || !password) return showToast('Заполни все поля!', 'error');

            registerBtn.innerText = 'Загрузка...';
            registerBtn.disabled = true;

            try {
                const res = await fetch('https://katiki-game.katiland.workers.dev/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                
                if (data.success) {
                    showToast('Успешно! Теперь войди.', 'success');
                    form.getChildByID('password').value = '';
                } else {
                    showToast(data.error, 'error');
                }
            } catch (e) {
                showToast('Ошибка сети', 'error');
            } finally {
                registerBtn.innerText = 'Регистрация';
                registerBtn.disabled = false;
            }
        });

        loginBtn.addEventListener('click', async () => {
            const username = form.getChildByID('username').value;
            const password = form.getChildByID('password').value;
            if (!username || !password) return showToast('Заполни все поля!', 'error');

            loginBtn.innerText = 'Загрузка...';
            loginBtn.disabled = true;

            try {
                const res = await fetch('https://katiki-game.katiland.workers.dev/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                
                if (data.success) {
                    showToast('Успешный вход!', 'success');
                    setTimeout(() => {
                        localStorage.setItem('katiki_username', data.username);
                        form.destroy();
                        this.startGame();
                    }, 1000);
                } else {
                    showToast(data.error, 'error');
                }
            } catch (e) {
                showToast('Ошибка сети', 'error');
            } finally {
                loginBtn.innerText = 'Войти';
                loginBtn.disabled = false;
            }
        });
    }

    startGame() {
        if (this.isLoggedIn) return;
        this.isLoggedIn = true;
        
        this.children.list.filter(child => child.type === 'DOMElement').forEach(el => el.destroy());

        this.drawIsometricGrid();
        this.setupControls();
        this.connectToServer();
        
        this.setupLogoutButton();
    }

    setupLogoutButton() {
        const btnHtml = `
            <style>
                .logout-btn {
                    padding: 10px 20px; background: linear-gradient(135deg, #F44336, #D32F2F);
                    color: white; border: none; border-radius: 10px; font-family: 'Nunito', sans-serif;
                    font-weight: 800; font-size: 16px; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                    transition: all 0.2s;
                }
                .logout-btn:hover { transform: scale(1.05); }
            </style>
            <button class="logout-btn" id="logout">Выйти</button>
        `;
        const logoutDom = this.add.dom(1024 - 60, 30).createFromHTML(btnHtml);
        logoutDom.getChildByID('logout').addEventListener('click', () => {
            localStorage.removeItem('katiki_username');
            window.location.reload();
        });
    }

    drawIsometricGrid() {
        const graphics = this.add.graphics();
        const tileWidth = 64;
        const tileHeight = 32;
        
        graphics.lineStyle(1, 0x000000, 0.2);
        
        for (let row = 0; row < 20; row++) {
            for (let col = 0; col < 20; col++) {
                // Добавляем легкий рандом в цвет травы
                const colorVariant = Phaser.Math.Between(0, 1) === 0 ? 0x90EE90 : 0x98EE98;
                graphics.fillStyle(colorVariant, 1);
                
                const x = 512 + (col - row) * (tileWidth / 2);
                const y = 384 + (col + row) * (tileHeight / 2);
                
                graphics.beginPath();
                graphics.moveTo(x, y - tileHeight / 2);
                graphics.lineTo(x + tileWidth / 2, y);
                graphics.lineTo(x, y + tileHeight / 2);
                graphics.lineTo(x - tileWidth / 2, y);
                graphics.closePath();
                graphics.fillPath();
                graphics.strokePath();
            }
        }
    }

    setupControls() {
        this.input.on('pointerdown', (pointer) => {
            if (pointer.leftButtonDown()) {
                this.targetX = pointer.worldX;
                this.targetY = pointer.worldY;
                this.createClickMarker(pointer.worldX, pointer.worldY);
            }
        });
    }

    createClickMarker(x, y) {
        const marker = this.add.ellipse(x, y, 20, 10, 0x00FF00, 0.6);
        this.tweens.add({
            targets: marker,
            alpha: 0,
            scaleX: 2,
            scaleY: 2,
            duration: 400,
            onComplete: () => marker.destroy()
        });
    }

    connectToServer() {
        const username = localStorage.getItem('katiki_username') || 'Гость';
        this.ws = new WebSocket(`wss://katiki-game.katiland.workers.dev/ws?username=${encodeURIComponent(username)}`);

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'init') {
                this.myId = data.id;
                this.createPlayer(this.myId, 512, 384, username);

                data.players.forEach(p => {
                    this.createPlayer(p.id, p.x, p.y, 'Игрок', p.angle);
                });
            } 
            else if (data.type === 'player_joined') {
                this.createPlayer(data.player.id, data.player.x, data.player.y, 'Игрок', data.player.angle);
            } 
            else if (data.type === 'player_moved') {
                const p = this.otherPlayers[data.id];
                if (p) {
                    // Плавное перемещение
                    this.tweens.add({
                        targets: p,
                        x: data.x,
                        y: data.y,
                        duration: 100
                    });
                    // Обновляем направление взгляда
                    this.updatePlayerDirection(p, data.angle);
                }
            } 
            else if (data.type === 'player_left') {
                const p = this.otherPlayers[data.id];
                if (p) {
                    p.destroy();
                    delete this.otherPlayers[data.id];
                }
            }
        };
    }

    createPlayer(id, x, y, name, angle = 0) {
        const container = this.add.container(x, y);
        
        // Спрайт катика (по умолчанию смотрит вниз)
        const sprite = this.add.sprite(0, 0, 'katik_down');
        sprite.setOrigin(0.5, 0.8); // Точка опоры чуть ниже центра
        container.sprite = sprite;
        
        // Никнейм
        const text = this.add.text(0, -45, name, { 
            fontSize: '14px', 
            fill: '#ffffff', 
            backgroundColor: '#00000088', 
            padding: { x: 6, y: 3 },
            borderRadius: 8
        }).setOrigin(0.5);

        container.add([sprite, text]);
        container.setDepth(y);

        if (id === this.myId) {
            this.myPlayer = container;
        } else {
            this.otherPlayers[id] = container;
            // Сразу поворачиваем других игроков
            this.updatePlayerDirection(container, angle);
        }
    }

    updatePlayerDirection(container, angle) {
        // Определяем направление по углу (0 - вправо, PI/2 - вниз и т.д.)
        let dir = 'down';
        if (angle > -Math.PI/4 && angle <= Math.PI/4) dir = 'right';
        else if (angle > Math.PI/4 && angle <= 3*Math.PI/4) dir = 'down';
        else if (angle > -3*Math.PI/4 && angle <= -Math.PI/4) dir = 'up';
        else dir = 'left';

        if (container.currentDir !== dir) {
            container.currentDir = dir;
            container.sprite.setTexture(`katik_${dir}`);
        }
    }

    update(time, delta) {
        if (!this.myPlayer) return;

        const pointer = this.input.activePointer;
        
        // 1. Персонаж всегда смотрит на курсор (даже если стоит)
        const angleToCursor = Phaser.Math.Angle.Between(
            this.myPlayer.x, this.myPlayer.y, 
            pointer.worldX, pointer.worldY
        );
        this.updatePlayerDirection(this.myPlayer, angleToCursor);

        // 2. Движение к точке клика
        if (this.targetX !== null && this.targetY !== null) {
            const dx = this.targetX - this.myPlayer.x;
            const dy = this.targetY - this.myPlayer.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < this.speed) {
                // Дошли до цели
                this.myPlayer.x = this.targetX;
                this.myPlayer.y = this.targetY;
                this.targetX = null;
                this.targetY = null;
                
                // Останавливаем анимацию ходьбы
                this.myPlayer.sprite.y = 0;
            } else {
                const moveAngle = Math.atan2(dy, dx);
                this.myPlayer.x += Math.cos(moveAngle) * this.speed;
                this.myPlayer.y += Math.sin(moveAngle) * this.speed;
                
                // Анимация ходьбы (подпрыгивание)
                this.myPlayer.sprite.y = Math.abs(Math.sin(time * 0.015)) * -5;

                this.myPlayer.setDepth(this.myPlayer.y);

                // Отправляем на сервер
                if (time - this.lastSendTime > 50) {
                    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                        this.ws.send(JSON.stringify({
                            type: 'move',
                            x: Math.round(this.myPlayer.x),
                            y: Math.round(this.myPlayer.y),
                            angle: angleToCursor // Отправляем угол на курсор
                        }));
                    }
                    this.lastSendTime = time;
                }
            }
        }
    }
}