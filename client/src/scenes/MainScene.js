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
    }

    preload() {}

    create() {
        if (localStorage.getItem('katiki_username')) {
            this.startGame();
        } else {
            this.showAuthForm();
        }
    }

    showAuthForm() {
        // Огромный HTML-код с красивым дизайном и CSS-анимациями
        const formHtml = `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;800&display=swap');
                
                .auth-container {
                    display: flex;
                    width: 800px;
                    height: 480px;
                    background: rgba(255, 255, 255, 0.95);
                    border-radius: 30px;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.3), inset 0 0 0 4px rgba(255,255,255,0.5);
                    overflow: hidden;
                    font-family: 'Nunito', sans-serif;
                    backdrop-filter: blur(10px);
                    animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                }

                @keyframes popIn {
                    0% { transform: scale(0.8); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }

                .auth-left {
                    flex: 1;
                    padding: 40px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    background: #ffffff;
                }

                .auth-right {
                    flex: 1;
                    background: linear-gradient(135deg, #FF9A9E 0%, #FECFEF 99%, #FECFEF 100%);
                    padding: 40px;
                    display: flex;
                    flex-direction: column;
                    color: #333;
                    position: relative;
                }

                .auth-title {
                    font-size: 32px;
                    font-weight: 800;
                    color: #333;
                    margin-bottom: 30px;
                    text-align: center;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
                }

                .auth-input {
                    width: 100%;
                    padding: 15px 20px;
                    margin-bottom: 20px;
                    border: 2px solid #E0E0E0;
                    border-radius: 15px;
                    font-size: 16px;
                    font-family: 'Nunito', sans-serif;
                    transition: all 0.3s ease;
                    box-sizing: border-box;
                    outline: none;
                }

                .auth-input:focus {
                    border-color: #4CAF50;
                    box-shadow: 0 0 10px rgba(76, 175, 80, 0.2);
                }

                .auth-buttons {
                    display: flex;
                    gap: 15px;
                    margin-top: 10px;
                }

                .auth-btn {
                    flex: 1;
                    padding: 15px;
                    border: none;
                    border-radius: 15px;
                    font-size: 18px;
                    font-weight: 800;
                    color: white;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-family: 'Nunito', sans-serif;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                }

                .auth-btn:hover {
                    transform: translateY(-3px) scale(1.02);
                }

                .auth-btn:active {
                    transform: translateY(1px);
                }

                .btn-login {
                    background: linear-gradient(135deg, #4CAF50, #45a049);
                }

                .btn-register {
                    background: linear-gradient(135deg, #2196F3, #1976D2);
                }

                .news-title {
                    font-size: 28px;
                    font-weight: 800;
                    margin-bottom: 20px;
                    text-align: center;
                    text-shadow: 1px 1px 2px rgba(255,255,255,0.5);
                }

                .news-item {
                    background: rgba(255,255,255,0.7);
                    padding: 15px;
                    border-radius: 15px;
                    margin-bottom: 15px;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.05);
                    font-size: 14px;
                }

                .news-item b {
                    display: block;
                    font-size: 16px;
                    margin-bottom: 5px;
                    color: #D81B60;
                }

                /* Стили для кастомных уведомлений (Toast) */
                .toast-container {
                    position: absolute;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    z-index: 9999;
                }

                .toast {
                    padding: 15px 30px;
                    border-radius: 15px;
                    color: white;
                    font-weight: 800;
                    font-size: 16px;
                    box-shadow: 0 10px 20px rgba(0,0,0,0.2);
                    opacity: 0;
                    transform: translateY(-20px);
                    animation: slideDown 0.3s forwards, fadeOut 0.3s 2.7s forwards;
                    text-align: center;
                    min-width: 250px;
                }

                .toast.success { background: linear-gradient(135deg, #4CAF50, #45a049); }
                .toast.error { background: linear-gradient(135deg, #F44336, #D32F2F); }

                @keyframes slideDown {
                    to { opacity: 1; transform: translateY(0); }
                }

                @keyframes fadeOut {
                    to { opacity: 0; transform: translateY(-20px); }
                }
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
                    <div class="news-item">
                        <b>Добро пожаловать!</b>
                        Мы рады видеть тебя в мире Катиков. Создай своего персонажа и исследуй город!
                    </div>
                    <div class="news-item">
                        <b>Скоро обновление!</b>
                        Совсем скоро мы добавим новые домики, магазины и мини-игры. Следи за новостями!
                    </div>
                </div>
            </div>
        `;

        const form = this.add.dom(512, 384).createFromHTML(formHtml);

        // Функция для показа красивых уведомлений
        const showToast = (message, type = 'success') => {
            const toastBox = form.getChildByID('toast-box');
            if (!toastBox) return;
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.innerText = message;
            toastBox.appendChild(toast);
            // Удаляем элемент из DOM после завершения анимации
            setTimeout(() => toast.remove(), 3000);
        };

        const loginBtn = form.getChildByID('loginBtn');
        const registerBtn = form.getChildByID('registerBtn');

        registerBtn.addEventListener('click', async () => {
            const username = form.getChildByID('username').value;
            const password = form.getChildByID('password').value;
            
            if (!username || !password) {
                showToast('Заполни все поля!', 'error');
                return;
            }

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
            
            if (!username || !password) {
                showToast('Заполни все поля!', 'error');
                return;
            }

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
                    }, 1000); // Небольшая задержка, чтобы игрок увидел зеленое уведомление
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
    }

    drawIsometricGrid() {
        const graphics = this.add.graphics();
        const tileWidth = 64;
        const tileHeight = 32;
        
        graphics.lineStyle(1, 0x000000, 0.2);
        graphics.fillStyle(0x90EE90, 1);

        for (let row = 0; row < 20; row++) {
            for (let col = 0; col < 20; col++) {
                const x = 512 + (col - row) * (tileWidth / 2);
                const y = 384 + (col + row) * (tileHeight / 2);
                this.drawDiamond(graphics, x, y, tileWidth, tileHeight);
            }
        }
    }

    drawDiamond(graphics, cx, cy, width, height) {
        graphics.beginPath();
        graphics.moveTo(cx, cy - height / 2);
        graphics.lineTo(cx + width / 2, cy);
        graphics.lineTo(cx, cy + height / 2);
        graphics.lineTo(cx - width / 2, cy);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
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
        const marker = this.add.circle(x, y, 8, 0x00FF00, 0.8);
        this.tweens.add({
            targets: marker,
            alpha: 0,
            scale: 2,
            duration: 400,
            onComplete: () => marker.destroy()
        });
    }

    connectToServer() {
        const username = localStorage.getItem('katiki_username') || 'Гость';
        this.ws = new WebSocket(`wss://katiki-game.katiland.workers.dev/ws?username=${encodeURIComponent(username)}`);

        this.ws.onopen = () => {
            console.log('Подключено к серверу!');
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'init') {
                this.myId = data.id;
                this.createPlayer(this.myId, 512, 384, 0x0000FF, username);

                data.players.forEach(p => {
                    this.createPlayer(p.id, p.x, p.y, 0xFF0000, 'Игрок', p.angle);
                });
            } 
            else if (data.type === 'player_joined') {
                this.createPlayer(data.player.id, data.player.x, data.player.y, 0xFF0000, 'Игрок', data.player.angle);
            } 
            else if (data.type === 'player_moved') {
                const p = this.otherPlayers[data.id];
                if (p) {
                    this.tweens.add({
                        targets: p,
                        x: data.x,
                        y: data.y,
                        duration: 100
                    });
                    if (p.nose) {
                        p.nose.setPosition(Math.cos(data.angle) * 15, Math.sin(data.angle) * 15);
                    }
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

    createPlayer(id, x, y, color, name, angle = 0) {
        const container = this.add.container(x, y);
        const body = this.add.circle(0, 0, 15, color);
        body.setStrokeStyle(2, 0x000000);
        const nose = this.add.circle(Math.cos(angle) * 15, Math.sin(angle) * 15, 5, 0xFFFFFF);
        container.nose = nose;
        const text = this.add.text(0, -30, name, { fontSize: '14px', fill: '#fff', backgroundColor: '#00000088', padding: {x:4, y:2} }).setOrigin(0.5);

        container.add([body, nose, text]);
        container.setDepth(y);

        if (id === this.myId) {
            this.myPlayer = container;
        } else {
            this.otherPlayers[id] = container;
        }
    }

    update(time, delta) {
        if (!this.myPlayer || this.targetX === null) return;

        const dx = this.targetX - this.myPlayer.x;
        const dy = this.targetY - this.myPlayer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.speed) {
            this.myPlayer.x = this.targetX;
            this.myPlayer.y = this.targetY;
            this.targetX = null;
            this.targetY = null;
        } else {
            const angle = Math.atan2(dy, dx);
            this.myPlayer.x += Math.cos(angle) * this.speed;
            this.myPlayer.y += Math.sin(angle) * this.speed;
            this.myPlayer.nose.setPosition(Math.cos(angle) * 15, Math.sin(angle) * 15);
            this.myPlayer.setDepth(this.myPlayer.y);

            if (time - this.lastSendTime > 50) {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({
                        type: 'move',
                        x: Math.round(this.myPlayer.x),
                        y: Math.round(this.myPlayer.y),
                        angle: angle
                    }));
                }
                this.lastSendTime = time;
            }
        }
    }
}