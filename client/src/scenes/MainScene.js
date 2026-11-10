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

    preload() {
        // Загружаем HTML для формы
        this.load.html('authForm', '../src/ui/auth.html');
    }

    create() {
        if (localStorage.getItem('katiki_username')) {
            this.startGame();
        } else {
            this.showAuthForm();
        }
    }

    showAuthForm() {
        const form = this.add.dom(512, 384).createFromCache('authForm');
        
        form.addListener('click');
        form.on('click', async (event) => {
            if (event.target.name === 'registerBtn') {
                const username = form.getChildByName('username').value;
                const password = form.getChildByName('password').value;
                if (!username || !password) {
                    alert('Введите логин и пароль');
                    return;
                }
                const res = await fetch('https://katiki-game.katiland.workers.dev/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                if (data.success) {
                    alert('Регистрация успешна! Теперь войдите.');
                } else {
                    alert(data.error);
                }
            }
            if (event.target.name === 'loginBtn') {
                const username = form.getChildByName('username').value;
                const password = form.getChildByName('password').value;
                if (!username || !password) {
                    alert('Введите логин и пароль');
                    return;
                }
                const res = await fetch('https://katiki-game.katiland.workers.dev/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                if (data.success) {
                    localStorage.setItem('katiki_username', data.username);
                    form.destroy();
                    this.startGame();
                } else {
                    alert(data.error);
                }
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
                this.createPlayer(this.myId, 512, 384, 0x0000FF, 'Вы');

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