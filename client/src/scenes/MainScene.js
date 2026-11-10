// client/src/scenes/MainScene.js
import Phaser from 'phaser';

export default class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
        this.myId = null;
        this.otherPlayers = {};
        this.myPlayer = null;
        this.ws = null;
        this.speed = 5;
        this.lastSendTime = 0;
        this.targetX = null;
        this.targetY = null;
        this.isLoggedIn = false;
        this.currentDir = 'down';
        this.currentLocation = 'square';
        
        this.userData = { fluffies: 100, inventory: ["🍎", "🍣"] };
        this.obstacles = [];

        this.locations = {
            'square': { name: 'Центральная площадь', desc: 'Сердце города', color: 0x90EE90, arrowTo: [{ id: 'forest', x: 1600, y: 600 }] },
            'forest': { name: 'Изумрудный лес', desc: 'Тихое место', color: 0x228B22, arrowTo: [{ id: 'square', x: 800, y: 1200 }, { id: 'beach', x: 1600, y: 1200 }] },
            'beach': { name: 'Солнечный пляж', desc: 'Море и песок', color: 0xF4A460, arrowTo: [{ id: 'forest', x: 800, y: 600 }] }
        };
    }

    preload() {
        this.generateTextures();
    }

    create() {
        if (localStorage.getItem('katiki_username')) {
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
            if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'chat', text }));
        });
        this.game.events.on('teleportTo', (locId) => this.changeLocation(locId));

        this.setupControls();
        this.connectToServer();
        
        this.time.delayedCall(500, () => {
            this.game.events.emit('updateCurrency', this.userData.fluffies);
            this.game.events.emit('updateInventory', this.userData.inventory);
            this.game.events.emit('initMap', Object.keys(this.locations).map(k => ({id: k, ...this.locations[k]})), this.currentLocation);
            this.buildWorld();
        });
    }

    generateTextures() {
        // 1. Катик (4 стороны)
        const width = 64, height = 64;
        const colors = { body: '#F5A623', belly: '#FFFFFF', ears: '#E88A1A', eyes: '#222222', blush: '#FFB6C1', outline: '#B8731A' };
        const drawKatik = (key, dir) => {
            const canvas = this.textures.createCanvas(key, width, height);
            const ctx = canvas.context;
            const cx = width / 2, cy = height / 2;
            
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath(); ctx.ellipse(cx, cy + 20, 16, 8, 0, 0, Math.PI * 2); ctx.fill();
            
            ctx.fillStyle = colors.body;
            ctx.strokeStyle = colors.outline;
            ctx.lineWidth = 1.5;
            
            // Хвост
            ctx.beginPath();
            if (dir === 'left') ctx.ellipse(cx + 12, cy + 5, 12, 6, Math.PI / 4, 0, Math.PI * 2);
            else if (dir === 'right') ctx.ellipse(cx - 12, cy + 5, 12, 6, -Math.PI / 4, 0, Math.PI * 2);
            else ctx.ellipse(cx, cy + 10, 6, 12, 0, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();

            // Тело
            ctx.beginPath(); ctx.ellipse(cx, cy + 8, 16, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            if (dir !== 'up') {
                ctx.fillStyle = colors.belly;
                ctx.beginPath(); ctx.ellipse(cx, cy + 12, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
            }
            
            // Голова
            ctx.fillStyle = colors.body;
            ctx.beginPath(); ctx.arc(cx, cy - 6, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

            // Уши
            ctx.fillStyle = colors.ears;
            if (dir === 'down' || dir === 'up') {
                ctx.beginPath(); ctx.moveTo(cx - 14, cy - 18); ctx.lineTo(cx - 4, cy - 24); ctx.lineTo(cx - 6, cy - 10); ctx.fill(); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(cx + 14, cy - 18); ctx.lineTo(cx + 4, cy - 24); ctx.lineTo(cx + 6, cy - 10); ctx.fill(); ctx.stroke();
            } else if (dir === 'left') {
                ctx.beginPath(); ctx.moveTo(cx - 2, cy - 20); ctx.lineTo(cx - 12, cy - 22); ctx.lineTo(cx - 8, cy - 10); ctx.fill(); ctx.stroke();
            } else if (dir === 'right') {
                ctx.beginPath(); ctx.moveTo(cx + 2, cy - 20); ctx.lineTo(cx + 12, cy - 22); ctx.lineTo(cx + 8, cy - 10); ctx.fill(); ctx.stroke();
            }

            // Мордочка
            if (dir === 'down' || dir === 'left' || dir === 'right') {
                ctx.fillStyle = colors.eyes;
                const eyeX = dir === 'left' ? -8 : (dir === 'right' ? 8 : 0);
                if (dir === 'down') {
                    ctx.beginPath(); ctx.arc(cx - 7, cy - 6, 3, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(cx + 7, cy - 6, 3, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#FFF';
                    ctx.beginPath(); ctx.arc(cx - 8, cy - 7, 1.5, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(cx + 6, cy - 7, 1.5, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = colors.blush;
                    ctx.beginPath(); ctx.ellipse(cx - 11, cy - 2, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.ellipse(cx + 11, cy - 2, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#FF8A8A';
                    ctx.beginPath(); ctx.moveTo(cx, cy - 2); ctx.lineTo(cx - 2, cy); ctx.lineTo(cx + 2, cy); ctx.fill();
                } else {
                    ctx.beginPath(); ctx.arc(cx + eyeX, cy - 6, 3, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#FFF';
                    ctx.beginPath(); ctx.arc(cx + eyeX + (dir === 'left' ? -1.5 : 1.5), cy - 7, 1.5, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = colors.blush;
                    ctx.beginPath(); ctx.ellipse(cx + eyeX + (dir === 'left' ? -4 : 4), cy - 2, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
                }
            }
            canvas.refresh();
        };
        ['down', 'up', 'left', 'right'].forEach(d => drawKatik('katik_' + d, d));

        // 2. Дерево
        const treeCanvas = this.textures.createCanvas('tree', 120, 160);
        const tCtx = treeCanvas.context;
        tCtx.fillStyle = 'rgba(0,0,0,0.25)'; tCtx.beginPath(); tCtx.ellipse(60, 140, 40, 15, 0, 0, Math.PI*2); tCtx.fill();
        tCtx.fillStyle = '#5C4033'; tCtx.fillRect(50, 90, 20, 50);
        tCtx.fillStyle = '#8B4513'; tCtx.fillRect(52, 90, 10, 50);
        // Крона (слои)
        tCtx.fillStyle = '#228B22'; tCtx.beginPath(); tCtx.arc(60, 80, 45, 0, Math.PI*2); tCtx.fill();
        tCtx.fillStyle = '#2E8B57'; tCtx.beginPath(); tCtx.arc(45, 60, 35, 0, Math.PI*2); tCtx.fill(); tCtx.beginPath(); tCtx.arc(75, 60, 35, 0, Math.PI*2); tCtx.fill();
        tCtx.fillStyle = '#3CB371'; tCtx.beginPath(); tCtx.arc(60, 45, 30, 0, Math.PI*2); tCtx.fill();
        tCtx.fillStyle = '#90EE90'; tCtx.beginPath(); tCtx.arc(50, 40, 15, 0, Math.PI*2); tCtx.fill();
        treeCanvas.refresh();

        // 3. Дом (Полноценная изометрия)
        const houseCanvas = this.textures.createCanvas('house', 160, 180);
        const hCtx = houseCanvas.context;
        // Тень
        hCtx.fillStyle = 'rgba(0,0,0,0.25)'; hCtx.beginPath(); hCtx.ellipse(80, 150, 70, 35, 0, 0, Math.PI*2); hCtx.fill();
        // Стена левая (светлая)
        hCtx.fillStyle = '#FDF5E6'; 
        hCtx.beginPath(); hCtx.moveTo(20, 80); hCtx.lineTo(80, 110); hCtx.lineTo(80, 160); hCtx.lineTo(20, 130); hCtx.fill();
        // Стена правая (тёмная)
        hCtx.fillStyle = '#DEB887'; 
        hCtx.beginPath(); hCtx.moveTo(80, 110); hCtx.lineTo(140, 80); hCtx.lineTo(140, 130); hCtx.lineTo(80, 160); hCtx.fill();
        // Крыша левая
        hCtx.fillStyle = '#B22222'; 
        hCtx.beginPath(); hCtx.moveTo(10, 80); hCtx.lineTo(80, 25); hCtx.lineTo(80, 60); hCtx.lineTo(30, 105); hCtx.fill();
        // Крыша правая
        hCtx.fillStyle = '#8B0000'; 
        hCtx.beginPath(); hCtx.moveTo(80, 25); hCtx.lineTo(150, 80); hCtx.lineTo(130, 105); hCtx.lineTo(80, 60); hCtx.fill();
        // Труба
        hCtx.fillStyle = '#696969'; hCtx.fillRect(110, 45, 15, 30);
        hCtx.fillStyle = '#A9A9A9'; hCtx.fillRect(110, 45, 15, 5);
        // Дверь
        hCtx.fillStyle = '#8B4513'; 
        hCtx.beginPath(); hCtx.moveTo(85, 125); hCtx.lineTo(105, 115); hCtx.lineTo(105, 145); hCtx.lineTo(85, 155); hCtx.fill();
        // Окно
        hCtx.fillStyle = '#87CEEB'; 
        hCtx.beginPath(); hCtx.moveTo(35, 105); hCtx.lineTo(55, 95); hCtx.lineTo(55, 115); hCtx.lineTo(35, 125); hCtx.fill();
        houseCanvas.refresh();

        // 4. Фонтан
        const fountCanvas = this.textures.createCanvas('fountain', 160, 140);
        const fCtx = fountCanvas.context;
        fCtx.fillStyle = 'rgba(0,0,0,0.25)'; fCtx.beginPath(); fCtx.ellipse(80, 110, 70, 30, 0, 0, Math.PI*2); fCtx.fill();
        fCtx.fillStyle = '#D3D3D3'; fCtx.beginPath(); fCtx.ellipse(80, 90, 70, 35, 0, 0, Math.PI*2); fCtx.fill();
        fCtx.fillStyle = '#4682B4'; fCtx.beginPath(); fCtx.ellipse(80, 90, 55, 25, 0, 0, Math.PI*2); fCtx.fill();
        fCtx.fillStyle = '#87CEFA'; fCtx.beginPath(); fCtx.ellipse(80, 85, 50, 20, 0, 0, Math.PI*2); fCtx.fill();
        fCtx.fillStyle = '#A9A9A9'; fCtx.fillRect(70, 40, 20, 50);
        fCtx.beginPath(); fCtx.ellipse(80, 40, 30, 15, 0, 0, Math.PI*2); fCtx.fill();
        fCtx.fillStyle = '#87CEFA'; fCtx.beginPath(); fCtx.ellipse(80, 35, 25, 10, 0, 0, Math.PI*2); fCtx.fill();
        fountCanvas.refresh();
        
        // 5. Стрелка
        const size = 64;
        const arrowCanvas = this.textures.createCanvas('arrow_tile', size, size);
        const aCtx = arrowCanvas.context;
        aCtx.fillStyle = 'rgba(0, 255, 0, 0.4)'; aCtx.beginPath(); aCtx.ellipse(size/2, size/2, 28, 14, 0, 0, Math.PI * 2); aCtx.fill();
        aCtx.fillStyle = '#00FF00'; aCtx.beginPath();
        aCtx.moveTo(size/2, size/2 + 15); aCtx.lineTo(size/2 - 15, size/2); aCtx.lineTo(size/2 - 5, size/2);
        aCtx.lineTo(size/2 - 5, size/2 - 15); aCtx.lineTo(size/2 + 5, size/2 - 15); aCtx.lineTo(size/2 + 5, size/2);
        aCtx.lineTo(size/2 + 15, size/2); aCtx.closePath(); aCtx.fill();
        arrowCanvas.refresh();
        
        // 6. Частица воды
        const partCanvas = this.textures.createCanvas('water_drop', 8, 8);
        const pCtx = partCanvas.context;
        pCtx.fillStyle = '#87CEFA';
        pCtx.beginPath(); pCtx.arc(4, 4, 4, 0, Math.PI*2); pCtx.fill();
        partCanvas.refresh();
    }

    buildWorld() {
        if (this.worldGraphics) this.worldGraphics.destroy();
        if (this.arrowsGroup) this.arrowsGroup.clear(true, true);
        if (this.emitters) this.emitters.forEach(e => e.destroy());
        
        this.obstacles = [];
        this.emitters = [];
        this.worldGraphics = this.add.graphics();
        this.arrowsGroup = this.add.group();
        
        const locData = this.locations[this.currentLocation];
        const tileWidth = 64, tileHeight = 32;
        const size = 80; // Карта 80х80

        this.worldGraphics.lineStyle(1, 0x000000, 0.05);
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                const colorVar = Phaser.Display.Color.ValueToColor(locData.color).brighten(Phaser.Math.Between(-15, 15)).color;
                this.worldGraphics.fillStyle(colorVar, 1);
                
                const x = 512 + (col - row) * (tileWidth / 2);
                const y = 384 + (col + row - size) * (tileHeight / 2);
                
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

        if (this.currentLocation === 'square') {
            // Фонтан сдвинут вверх, чтобы освободить точку спавна (512, 450)
            this.spawnObject('fountain', 512, 300, 50);
            
            // Фонтан брызги
            const emitter = this.add.particles(512, 260, 'water_drop', {
                speed: { min: 20, max: 60 },
                angle: { min: 200, max: 340 },
                scale: { start: 1, end: 0 },
                lifespan: 800,
                gravityY: 150,
                frequency: 50
            });
            this.emitters.push(emitter);

            this.spawnObject('house', 250, 150, 60);
            this.spawnObject('house', 750, 150, 60);
            this.spawnObject('house', 150, 550, 60);
            this.spawnObject('house', 800, 550, 60);
            this.spawnObject('tree', 100, 300, 30);
            this.spawnObject('tree', 950, 300, 30);
        } 
        else if (this.currentLocation === 'forest') {
            // Деревья спавнятся на расстоянии от центра (512, 450)
            for(let i=0; i<30; i++) {
                let tx = Phaser.Math.Between(100, 900);
                let ty = Phaser.Math.Between(100, 700);
                // Проверка, чтобы не заспавнить на игроке
                if (Phaser.Math.Distance.Between(tx, ty, 512, 450) > 150) {
                    this.spawnObject('tree', tx, ty, 30);
                }
            }
        }
        else if (this.currentLocation === 'beach') {
            this.spawnObject('tree', 200, 200, 30);
            this.spawnObject('tree', 300, 600, 30);
            this.spawnObject('tree', 700, 200, 30);
        }

        locData.arrowTo.forEach(arrow => {
            const arrowSprite = this.add.sprite(arrow.x, arrow.y, 'arrow_tile');
            arrowSprite.setDepth(arrow.y);
            arrowSprite.targetLocation = arrow.id;
            this.arrowsGroup.add(arrowSprite);
            this.tweens.add({
                targets: arrowSprite, alpha: { from: 0.5, to: 1 }, scaleX: { from: 0.9, to: 1.1 }, scaleY: { from: 0.9, to: 1.1 },
                duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
            });
        });

        this.game.events.emit('updateLocationName', locData.name);
        
        this.cameras.main.setBounds(-1000, -1000, 3000, 2000);
        this.cameras.main.setZoom(1.2);
        if (this.myPlayer) this.cameras.main.startFollow(this.myPlayer, true, 0.1, 0.1);
    }

    spawnObject(key, x, y, radius) {
        const obj = this.add.image(x, y, key);
        obj.setOrigin(0.5, 0.9);
        obj.setDepth(y);
        this.obstacles.push({ x, y, r: radius });
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
                this.buildWorld();
                
                if (!this.myPlayer) {
                    // Спавн в безопасной зоне (сдвинут вниз от фонтана)
                    this.createPlayer(this.myId, 512, 450, username);
                    this.cameras.main.startFollow(this.myPlayer, true, 0.1, 0.1);
                }

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
        
        const text = this.add.text(0, -45, name, { fontSize: '14px', fontFamily: 'Nunito', fill: '#ffffff', backgroundColor: '#00000088', padding: { x: 6, y: 3 }, borderRadius: 8 }).setOrigin(0.5);

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
                // Безопасная точка телепортации
                this.myPlayer.x = 512;
                this.myPlayer.y = 450;
                this.myPlayer.setDepth(450);
            }
            this.buildWorld();
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
                let nextX = this.myPlayer.x + Math.cos(moveAngle) * this.speed;
                let nextY = this.myPlayer.y + Math.sin(moveAngle) * this.speed;
                
                // Проверка: если мы УЖЕ застряли в объекте, разрешаем движение, чтобы выбраться
                let alreadyStuck = false;
                for (let obs of this.obstacles) {
                    if (Phaser.Math.Distance.Between(this.myPlayer.x, this.myPlayer.y, obs.x, obs.y) < obs.r) {
                        alreadyStuck = true;
                        break;
                    }
                }

                let canMove = true;
                if (!alreadyStuck) {
                    for (let obs of this.obstacles) {
                        const distToObs = Phaser.Math.Distance.Between(nextX, nextY, obs.x, obs.y);
                        if (distToObs < obs.r + 15) { canMove = false; break; }
                    }
                }
                
                if (canMove) {
                    this.myPlayer.x = nextX;
                    this.myPlayer.y = nextY;
                    this.myPlayer.sprite.y = Math.abs(Math.sin(time * 0.015)) * -5;
                    this.myPlayer.setDepth(this.myPlayer.y);
                } else {
                    this.targetX = null;
                    this.targetY = null;
                }

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
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password })
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
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                
                if (data.success) {
                    showToast('Успешный вход!', 'success');
                    setTimeout(() => {
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
}