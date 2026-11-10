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
        this.fluffies = 120; // Валюта

        this.locations = {
            'square': { 
                name: 'Центральная площадь', 
                desc: 'Сердце города', 
                color: 0x90EE90, // Трава
                arrowTo: [{ id: 'forest', x: 700, y: 300 }]
            },
            'forest': { 
                name: 'Изумрудный лес', 
                desc: 'Тихое место для прогулок', 
                color: 0x2E8B57, // Темная трава
                arrowTo: [{ id: 'square', x: 300, y: 500 }, { id: 'beach', x: 700, y: 500 }]
            },
            'beach': { 
                name: 'Солнечный пляж', 
                desc: 'Море и песок', 
                color: 0xF4A460, // Песок
                arrowTo: [{ id: 'forest', x: 300, y: 300 }]
            }
        };
        this.arrows = [];
    }

    preload() {
        this.generateKatikTextures();
        this.generateArrowTexture();
    }

    create() {
        if (localStorage.getItem('katiki_username')) {
            this.startGame();
        } else {
            this.showAuthForm();
        }
    }

    startGame() {
        if (this.isLoggedIn) return;
        this.isLoggedIn = true;
        
        this.children.list.filter(child => child.type === 'DOMElement').forEach(el => el.destroy());
        
        this.scene.launch('UIScene'); // Запускаем UI поверх
        
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
        
        // Даем UI время инициализироваться
        this.time.delayedCall(500, () => {
            this.game.events.emit('updateCurrency', this.fluffies);
            this.game.events.emit('initMap', Object.keys(this.locations).map(k => ({id: k, ...this.locations[k]})), this.currentLocation);
            this.drawWorld();
        });
    }

    generateArrowTexture() {
        const size = 64;
        const canvas = this.textures.createCanvas('arrow_tile', size, size);
        const ctx = canvas.context;
        
        // Рисуем светящуюся стрелку вниз (изометрия)
        ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(size/2, size/2, 28, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#00FF00';
        ctx.beginPath();
        ctx.moveTo(size/2, size/2 + 15);
        ctx.lineTo(size/2 - 15, size/2);
        ctx.lineTo(size/2 - 5, size/2);
        ctx.lineTo(size/2 - 5, size/2 - 15);
        ctx.lineTo(size/2 + 5, size/2 - 15);
        ctx.lineTo(size/2 + 5, size/2);
        ctx.lineTo(size/2 + 15, size/2);
        ctx.closePath();
        ctx.fill();
        
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

            // Тень
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath(); ctx.ellipse(cx, cy + 18, 16, 8, 0, 0, Math.PI * 2); ctx.fill();

            // Хвост
            ctx.fillStyle = colors.body;
            ctx.beginPath();
            if (direction === 'left') ctx.ellipse(cx + 12, cy + 5, 12, 6, Math.PI / 4, 0, Math.PI * 2);
            else if (direction === 'right') ctx.ellipse(cx - 12, cy + 5, 12, 6, -Math.PI / 4, 0, Math.PI * 2);
            else ctx.ellipse(cx, cy + 10, 6, 12, 0, 0, Math.PI * 2);
            ctx.fill();

            // Тело
            ctx.fillStyle = colors.body;
            ctx.beginPath(); ctx.ellipse(cx, cy + 8, 16, 14, 0, 0, Math.PI * 2); ctx.fill();

            // Живот
            if (direction !== 'up') {
                ctx.fillStyle = colors.belly;
                ctx.beginPath(); ctx.ellipse(cx, cy + 12, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
            }

            // Голова
            ctx.fillStyle = colors.body;
            ctx.beginPath(); ctx.arc(cx, cy - 6, 18, 0, Math.PI * 2); ctx.fill();

            // Уши
            ctx.fillStyle = colors.ears;
            if (direction === 'down' || direction === 'up') {
                ctx.beginPath(); ctx.moveTo(cx - 14, cy - 18); ctx.lineTo(cx - 4, cy - 24); ctx.lineTo(cx - 6, cy - 10); ctx.fill();
                ctx.beginPath(); ctx.moveTo(cx + 14, cy - 18); ctx.lineTo(cx + 4, cy - 24); ctx.lineTo(cx + 6, cy - 10); ctx.fill();
            } else if (direction === 'left') {
                ctx.beginPath(); ctx.moveTo(cx - 2, cy - 20); ctx.lineTo(cx - 12, cy - 22); ctx.lineTo(cx - 8, cy - 10); ctx.fill();
            } else if (direction === 'right') {
                ctx.beginPath(); ctx.moveTo(cx + 2, cy - 20); ctx.lineTo(cx + 12, cy - 22); ctx.lineTo(cx + 8, cy - 10); ctx.fill();
            }

            // Лицо
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
                // Легкий шум для текстуры
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

        // Рисуем стрелки перехода
        locData.arrowTo.forEach(arrow => {
            const arrowSprite = this.add.sprite(arrow.x, arrow.y, 'arrow_tile');
            arrowSprite.setDepth(arrow.y);
            arrowSprite.targetLocation = arrow.id;
            this.arrowsGroup.add(arrowSprite);

            // Анимация пульсации
            this.tweens.add({
                targets: arrowSprite,
                alpha: { from: 0.5, to: 1 },
                scaleX: { from: 0.9, to: 1.1 },
                scaleY: { from: 0.9, to: 1.1 },
                duration: 800,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        });

        this.game.events.emit('updateLocationName', locData.name);
    }

    setupControls() {
        this.input.on('pointerdown', (pointer) => {
            // Игнорируем клики по UI
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
                // Если сервер вернул нашу локацию
                if (data.location) this.currentLocation = data.location;
                
                this.drawWorld();
                
                // Спавним себя по центру
                if (!this.myPlayer) {
                    this.createPlayer(this.myId, 512, 384, username);
                }

                data.players.forEach(p => {
                    if (p.location === this.currentLocation) {
                        this.createPlayer(p.id, p.x, p.y, p.name || 'Игрок', p.angle);
                    }
                });
            } 
            else if (data.type === 'player_joined') {
                if (data.player.location === this.currentLocation) {
                    this.createPlayer(data.player.id, data.player.x, data.player.y, data.player.name, data.player.angle);
                }
            } 
            else if (data.type === 'player_moved') {
                const p = this.otherPlayers[data.id];
                if (p) {
                    if (data.location === this.currentLocation) {
                        p.setVisible(true);
                        this.tweens.add({ targets: p, x: data.x, y: data.y, duration: 100 });
                        this.updatePlayerDirection(p, data.angle);
                    } else {
                        p.setVisible(false); // Скрываем, если он ушел в другую локу
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
        
        const text = this.add.text(0, -45, name, { 
            fontSize: '14px', fill: '#ffffff', backgroundColor: '#00000088', padding: { x: 6, y: 3 }, borderRadius: 8
        }).setOrigin(0.5);

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
        
        // Камера-шторка (Fade)
        this.cameras.main.fadeOut(300, 0, 0, 0);
        
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.currentLocation = locId;
            
            // Перемещаем себя в центр
            if (this.myPlayer) {
                this.myPlayer.x = 512;
                this.myPlayer.y = 384;
                this.myPlayer.setDepth(384);
            }

            this.drawWorld();
            
            // Обновляем карту в UI
            this.game.events.emit('initMap', Object.keys(this.locations).map(k => ({id: k, ...this.locations[k]})), this.currentLocation);

            // Отправляем на сервер
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
                
                // ПРОВЕРКА: Дошли ли мы до стрелки?
                if (this.arrowsGroup) {
                    this.arrowsGroup.getChildren().forEach(arrow => {
                        const distToArrow = Phaser.Math.Distance.Between(this.myPlayer.x, this.myPlayer.y, arrow.x, arrow.y);
                        if (distToArrow < 40) {
                            this.changeLocation(arrow.targetLocation);
                        }
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
                            type: 'move',
                            x: Math.round(this.myPlayer.x),
                            y: Math.round(this.myPlayer.y),
                            angle: angleToCursor,
                            location: this.currentLocation
                        }));
                    }
                    this.lastSendTime = time;
                }
            }
        }
    }
}