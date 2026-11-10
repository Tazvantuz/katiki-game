// client/src/scenes/MainScene.js
import Phaser from 'phaser';

export default class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
        this.myId = null;
        this.otherPlayers = {};
        this.myPlayer = null;
        this.ws = null;
        this.speed = 4;
        this.lastSendTime = 0;
        this.targetX = null;
        this.targetY = null;
        this.isLoggedIn = false;
        this.currentDir = 'down';
        this.currentLocation = 'square';
        
        // Данные игрока (заполняются из БД при входе)
        this.userData = {
            fluffies: 100,
            inventory: ["🍎", "🍣"]
        };

        this.locations = {
            'square': { name: 'Центральная площадь', desc: 'Сердце города', color: 0x90EE90, arrowTo: [{ id: 'forest', x: 700, y: 300 }] },
            'forest': { name: 'Изумрудный лес', desc: 'Тихое место для прогулок', color: 0x2E8B57, arrowTo: [{ id: 'square', x: 300, y: 500 }, { id: 'beach', x: 700, y: 500 }] },
            'beach': { name: 'Солнечный пляж', desc: 'Море и песок', color: 0xF4A460, arrowTo: [{ id: 'forest', x: 300, y: 300 }] }
        };
        this.arrows = [];
    }

    preload() {
        this.generateKatikTextures();
        this.generateArrowTexture();
    }

    create() {
        if (localStorage.getItem('katiki_username')) {
            // Загружаем сохраненные данные из localStorage
            this.userData.fluffies = parseInt(localStorage.getItem('katiki_fluffies') || '100');
            this.userData.inventory = JSON.parse(localStorage.getItem('katiki_inventory') || '["🍎", "🍣"]');
            this.startGame();
        } else {
            this.showAuthForm();
        }
    }

    startGame() {
        if (this.isLoggedIn) return;
        this.isLoggedIn = true;
        
        this.children.list.filter(child => child.type === 'DOMElement').forEach(el => el.destroy());
        this.scene.launch('UIScene');
        
        this.game.events.on('sendChatMessage', (text) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'chat', text }));
            }
        });

        this.game.events.on('teleportTo', (locId) => {
            this.changeLocation(locId);
        });

        this.setupControls();
        this.connectToServer();
        
        this.time.delayedCall(500, () => {
            // Отправляем данные в UI
            this.game.events.emit('updateCurrency', this.userData.fluffies);
            this.game.events.emit('updateInventory', this.userData.inventory);
            this.game.events.emit('initMap', Object.keys(this.locations).map(k => ({id: k, ...this.locations[k]})), this.currentLocation);
            this.drawWorld();
        });
    }

    generateArrowTexture() {
        const size = 64;
        const canvas = this.textures.createCanvas('arrow_tile', size, size);
        const ctx = canvas.context;
        
        ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.beginPath(); ctx.ellipse(size/2, size/2, 28, 14, 0, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = '#00FF00';
        ctx.beginPath();
        ctx.moveTo(size/2, size/2 + 15); ctx.lineTo(size/2 - 15, size/2); ctx.lineTo(size/2 - 5, size/2);
        ctx.lineTo(size/2 - 5, size/2 - 15); ctx.lineTo(size/2 + 5, size/2 - 15); ctx.lineTo(size/2 + 5, size/2);
        ctx.lineTo(size/2 + 15, size/2); ctx.closePath(); ctx.fill();
        
        canvas.refresh();
    }

    generateKatikTextures() {
        const width = 64;
        const height = 64;
        const colors = { body: '#F5A623', belly: '#FFFFFF', ears: '#E88A1A', eyes: '#222222', blush: '#FFB6C1' };

        const drawKatik = (key, direction) => {
            const canvas = this.textures.createCanvas(key, width, height);
            const ctx = canvas.context;
            ctx.clearRect(0, 0, width, height);
            const cx = width / 2; const cy = height / 2;

            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath(); ctx.ellipse(cx, cy + 18, 16, 8, 0, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = colors.body;
            ctx.beginPath();
            if (direction === 'left') ctx.ellipse(cx + 12, cy + 5, 12, 6, Math.PI / 4, 0, Math.PI * 2);
            else if (direction === 'right') ctx.ellipse(cx - 12, cy + 5, 12, 6, -Math.PI / 4, 0, Math.PI * 2);
            else ctx.ellipse(cx, cy + 10, 6, 12, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = colors.body;
            ctx.beginPath(); ctx.ellipse(cx, cy + 8, 16, 14, 0, 0, Math.PI * 2); ctx.fill();

            if (direction !== 'up') {
                ctx.fillStyle = colors.belly;
                ctx.beginPath(); ctx.ellipse(cx, cy + 12, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
            }

            ctx.fillStyle = colors.body;
            ctx.beginPath(); ctx.arc(cx, cy - 6, 18, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = colors.ears;
            if (direction === 'down' || direction === 'up') {
                ctx.beginPath(); ctx.moveTo(cx - 14, cy - 18); ctx.lineTo(cx - 4, cy - 24); ctx.lineTo(cx - 6, cy - 10); ctx.fill();
                ctx.beginPath(); ctx.moveTo(cx + 14, cy - 18); ctx.lineTo(cx + 4, cy - 24); ctx.lineTo(cx + 6, cy - 10); ctx.fill();
            } else if (direction === 'left') {
                ctx.beginPath(); ctx.moveTo(cx - 2, cy - 20); ctx.lineTo(cx - 12, cy - 22); ctx.lineTo(cx - 8, cy - 10); ctx.fill();
            } else if (direction === 'right') {
                ctx.beginPath(); ctx.moveTo(cx + 2, cy - 20); ctx.lineTo(cx + 12, cy - 22); ctx.lineTo(cx + 8, cy - 10); ctx.fill();
            }

            if (direction === 'down') {
                ctx.fillStyle = colors.eyes;
                ctx.beginPath(); ctx.arc(cx - 7, cy - 6, 3, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(cx + 7, cy - 6, 3, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#FFF';
                ctx.beginPath(); ctx.arc(cx - 8, cy - 7, 1, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(cx + 6, cy - 7, 1, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = colors.blush;
                ctx.beginPath(); ctx.ellipse(cx - 11, cy - 2, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(cx + 11, cy - 2, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#FF8A8A';
                ctx.beginPath(); ctx.moveTo(cx, cy - 2); ctx.lineTo(cx - 2, cy); ctx.lineTo(cx + 2, cy); ctx.fill();
            } else if (direction === 'left') {
                ctx.fillStyle = colors.eyes;
                ctx.beginPath(); ctx.arc(cx - 8, cy - 6, 3, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#FFF';
                ctx.beginPath(); ctx.arc(cx - 9, cy - 7, 1, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = colors.blush;
                ctx.beginPath(); ctx.ellipse(cx - 12, cy - 2, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
            } else if (direction === 'right') {
                ctx.fillStyle = colors.eyes;
                ctx.beginPath(); ctx.arc(cx + 8, cy - 6, 3, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#FFF';
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
                        // Сохраняем данные игрока в localStorage
                        localStorage.setItem('katiki_username', data.username);
                        localStorage.setItem('katiki_fluffies', data.fluffies);
                        localStorage.setItem('katiki_inventory', JSON.stringify(data.inventory));
                        
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

    drawWorld() {
        if (this.worldGraphics) this.worldGraphics.destroy();
        if (this.arrowsGroup) this.arrowsGroup.clear(true, true);

        this.worldGraphics = this.add.graphics();
        this.arrowsGroup = this.add.group();
        const locData = this.locations[this.currentLocation];
        
        const tileWidth = 64;
        const tileHeight = 32;
        
        this.worldGraphics.lineStyle(1, 0x000000, 0.1);

        for (let row = 0; row < 20; row++) {
            for (let col = 0; col < 20; col++) {
                const colorVariant = Phaser.Display.Color.ValueToColor(locData.color).brighten(Phaser.Math.Between(-10, 10)).color;
                this.worldGraphics.fillStyle(colorVariant, 1);
                
                const x = 512 + (col - row) * (tileWidth / 2);
                const y = 384 + (col + row) * (tileHeight / 2);
                
                this.worldGraphics.beginPath();
                this.worldGraphics.moveTo(x, y - tileHeight / 2);
                this.worldGraphics.lineTo(x + tileWidth / 2, y);
                this.worldGraphics.lineTo(x, y + tileHeight / 2);
                this.worldGraphics.lineTo(x - tileWidth / 2, y);
                this.worldGraphics.closePath();
                this.worldGraphics.fillPath();
                this.worldGraphics.strokePath();
            }
        }

        locData.arrowTo.forEach(arrow => {
            const arrowSprite = this.add.sprite(arrow.x, arrow.y, 'arrow_tile');
            arrowSprite.setDepth(arrow.y);
            arrowSprite.targetLocation = arrow.id;
            this.arrowsGroup.add(arrowSprite);

            this.tweens.add({
                targets: arrowSprite,
                alpha: { from: 0.5, to: 1 },
                scaleX: { from: 0.9, to: 1.1 },
                scaleY: { from: 0.9, to: 1.1 },
                duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
            });
        });

        this.game.events.emit('updateLocationName', locData.name);
    }

    setupControls() {
        this.input.on('pointerdown', (pointer) => {
            if (pointer.event.target.tagName === 'DIV' || pointer.event.target.tagName === 'BUTTON' || pointer.event.target.tagName === 'INPUT') return;

            if (pointer.leftButtonDown()) {
                this.targetX = pointer.worldX;
                this.targetY = pointer.worldY;
                this.createClickMarker(pointer.worldX, pointer.worldY);
            }
        });
    }

    createClickMarker(x, y) {
        const marker = this.add.ellipse(x, y, 20, 10, 0x00FF00, 0.8);
        this.tweens.add({
            targets: marker, alpha: 0, scaleX: 2, scaleY: 2, duration: 400, onComplete: () => marker.destroy()
        });
    }

    connectToServer() {
        const username = localStorage.getItem('katiki_username') || 'Гость';
        this.ws = new WebSocket(`wss://katiki-game.katiland.workers.dev/ws?username=${encodeURIComponent(username)}`);

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'init') {
                this.myId = data.id;
                if (data.location) this.currentLocation = data.location;
                this.drawWorld();
                
                if (!this.myPlayer) this.createPlayer(this.myId, 512, 384, username);

                data.players.forEach(p => {
                    if (p.location === this.currentLocation) this.createPlayer(p.id, p.x, p.y, p.name || 'Игрок', p.angle);
                });
            } 
            else if (data.type === 'player_joined') {
                if (data.player.location === this.currentLocation) this.createPlayer(data.player.id, data.player.x, data.player.y, data.player.name, data.player.angle);
            } 
            else if (data.type === 'player_moved') {
                const p = this.otherPlayers[data.id];
                if (p) {
                    if (data.location === this.currentLocation) {
                        p.setVisible(true);
                        this.tweens.add({ targets: p, x: data.x, y: data.y, duration: 100 });
                        this.updatePlayerDirection(p, data.angle);
                    } else {
                        p.setVisible(false);
                    }
                }
            } 
            else if (data.type === 'player_left') {
                const p = this.otherPlayers[data.id];
                if (p) { p.destroy(); delete this.otherPlayers[data.id]; }
            }
            else if (data.type === 'chat') {
                this.game.events.emit('newChatMessage', { name: data.name, text: data.text, color: data.color });
            }
        };
    }

    createPlayer(id, x, y, name, angle = 0) {
        const container = this.add.container(x, y);
        const sprite = this.add.sprite(0, 0, 'katik_down').setOrigin(0.5, 0.8);
        container.sprite = sprite;
        
        const text = this.add.text(0, -45, name, { fontSize: '14px', fill: '#ffffff', backgroundColor: '#00000088', padding: { x: 6, y: 3 }, borderRadius: 8 }).setOrigin(0.5);

        container.add([sprite, text]);
        container.setDepth(y);

        if (id === this.myId) {
            this.myPlayer = container;
        } else {
            this.otherPlayers[id] = container;
            this.updatePlayerDirection(container, angle);
        }
    }

    updatePlayerDirection(container, angle) {
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

    changeLocation(locId) {
        if (!this.locations[locId]) return;
        this.cameras.main.fadeOut(300, 0, 0, 0);
        
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.currentLocation = locId;
            if (this.myPlayer) {
                this.myPlayer.x = 512;
                this.myPlayer.y = 384;
                this.myPlayer.setDepth(384);
            }
            this.drawWorld();
            this.game.events.emit('initMap', Object.keys(this.locations).map(k => ({id: k, ...this.locations[k]})), this.currentLocation);

            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'change_location', location: locId }));
            }
            this.cameras.main.fadeIn(300, 0, 0, 0);
        });
    }

    update(time, delta) {
        if (!this.myPlayer || !this.isLoggedIn) return;

        const pointer = this.input.activePointer;
        const angleToCursor = Phaser.Math.Angle.Between(this.myPlayer.x, this.myPlayer.y, pointer.worldX, pointer.worldY);
        this.updatePlayerDirection(this.myPlayer, angleToCursor);

        if (this.targetX !== null && this.targetY !== null) {
            const dx = this.targetX - this.myPlayer.x;
            const dy = this.targetY - this.myPlayer.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < this.speed) {
                this.myPlayer.x = this.targetX;
                this.myPlayer.y = this.targetY;
                this.targetX = null;
                this.targetY = null;
                this.myPlayer.sprite.y = 0;
                
                if (this.arrowsGroup) {
                    this.arrowsGroup.getChildren().forEach(arrow => {
                        const distToArrow = Phaser.Math.Distance.Between(this.myPlayer.x, this.myPlayer.y, arrow.x, arrow.y);
                        if (distToArrow < 40) this.changeLocation(arrow.targetLocation);
                    });
                }
            } else {
                const moveAngle = Math.atan2(dy, dx);
                this.myPlayer.x += Math.cos(moveAngle) * this.speed;
                this.myPlayer.y += Math.sin(moveAngle) * this.speed;
                
                this.myPlayer.sprite.y = Math.abs(Math.sin(time * 0.015)) * -5;
                this.myPlayer.setDepth(this.myPlayer.y);

                if (time - this.lastSendTime > 50) {
                    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                        this.ws.send(JSON.stringify({
                            type: 'move', x: Math.round(this.myPlayer.x), y: Math.round(this.myPlayer.y), angle: angleToCursor, location: this.currentLocation
                        }));
                    }
                    this.lastSendTime = time;
                }
            }
        }
    }
}