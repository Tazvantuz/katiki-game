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
        this.worldObjects = []; // Массив для очистки локаций
        
        this.mapSize = 20;
        this.tileWidth = 64;
        this.tileHeight = 32;
        this.mapCenterX = 512;
        this.mapCenterY = 384;

        this.bounds = { x: -128, y: 64, w: 1280, h: 640 };

        this.locations = {
            'square': { name: 'Центральная площадь', desc: 'Сердце города', color: 0x7CFC00, arrowTo: [{ id: 'forest', x: 512, y: 680 }] },
            'forest': { name: 'Изумрудный лес', desc: 'Тихое место', color: 0x228B22, arrowTo: [{ id: 'square', x: 512, y: 100 }, { id: 'beach', x: 850, y: 400 }] },
            'beach': { name: 'Солнечный пляж', desc: 'Море и песок', color: 0xEDC9AF, arrowTo: [{ id: 'forest', x: 200, y: 400 }] }
        };
    }

    preload() {
        this.generateTextures();
    }

    create() {
        // Используем sessionStorage для проверки активной сессии (чтобы вторая вкладка требовала логин)
        if (sessionStorage.getItem('katiki_active_session')) {
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
        const TW = this.tileWidth, TH = this.tileHeight;

        // --- 1. КАТИК ---
        const colors = { body: '#F5A623', belly: '#FFFFFF', ears: '#E88A1A', eyes: '#222222', blush: '#FFB6C1', outline: '#B8731A' };
        const drawKatik = (key, dir) => {
            const canvas = this.textures.createCanvas(key, 64, 64);
            const ctx = canvas.context;
            const cx = 32, cy = 32;
            
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath(); ctx.ellipse(cx, cy + 20, 16, 8, 0, 0, Math.PI * 2); ctx.fill();
            
            ctx.fillStyle = colors.body;
            ctx.strokeStyle = colors.outline;
            ctx.lineWidth = 1.5;
            
            ctx.beginPath();
            if (dir === 'left') ctx.ellipse(cx + 12, cy + 5, 12, 6, Math.PI / 4, 0, Math.PI * 2);
            else if (dir === 'right') ctx.ellipse(cx - 12, cy + 5, 12, 6, -Math.PI / 4, 0, Math.PI * 2);
            else ctx.ellipse(cx, cy + 10, 6, 12, 0, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();

            ctx.beginPath(); ctx.ellipse(cx, cy + 8, 16, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            if (dir !== 'up') {
                ctx.fillStyle = colors.belly;
                ctx.beginPath(); ctx.ellipse(cx, cy + 12, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
            }
            ctx.fillStyle = colors.body;
            ctx.beginPath(); ctx.arc(cx, cy - 6, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

            ctx.fillStyle = colors.ears;
            if (dir === 'down' || dir === 'up') {
                ctx.beginPath(); ctx.moveTo(cx - 14, cy - 18); ctx.lineTo(cx - 4, cy - 24); ctx.lineTo(cx - 6, cy - 10); ctx.fill(); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(cx + 14, cy - 18); ctx.lineTo(cx + 4, cy - 24); ctx.lineTo(cx + 6, cy - 10); ctx.fill(); ctx.stroke();
            } else if (dir === 'left') {
                ctx.beginPath(); ctx.moveTo(cx - 2, cy - 20); ctx.lineTo(cx - 12, cy - 22); ctx.lineTo(cx - 8, cy - 10); ctx.fill(); ctx.stroke();
            } else if (dir === 'right') {
                ctx.beginPath(); ctx.moveTo(cx + 2, cy - 20); ctx.lineTo(cx + 12, cy - 22); ctx.lineTo(cx + 8, cy - 10); ctx.fill(); ctx.stroke();
            }

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

        // --- 2. ДОМ ---
        const hCanvas = this.textures.createCanvas('house', 200, 220);
        const hCtx = hCanvas.context;
        hCtx.translate(100, 110);
        const w = 60, h = 30, wallH = 70, roofH = 50;
        
        hCtx.fillStyle = 'rgba(0,0,0,0.3)'; hCtx.beginPath(); hCtx.ellipse(0, h + wallH, w + 20, h + 15, 0, 0, Math.PI*2); hCtx.fill();
        hCtx.fillStyle = '#FFF8DC'; hCtx.beginPath(); hCtx.moveTo(-w, 0); hCtx.lineTo(0, h); hCtx.lineTo(0, h + wallH); hCtx.lineTo(-w, wallH); hCtx.fill();
        hCtx.strokeStyle = '#DEB887'; hCtx.lineWidth = 2; hCtx.stroke();
        hCtx.fillStyle = '#DEB887'; hCtx.beginPath(); hCtx.moveTo(0, h); hCtx.lineTo(w, 0); hCtx.lineTo(w, wallH); hCtx.lineTo(0, h + wallH); hCtx.fill();
        hCtx.strokeStyle = '#CD853F'; hCtx.stroke();
        hCtx.fillStyle = '#B22222'; hCtx.beginPath(); hCtx.moveTo(0, -roofH); hCtx.lineTo(w + 10, 0); hCtx.lineTo(0, h); hCtx.fill();
        hCtx.strokeStyle = '#8B0000'; hCtx.stroke();
        hCtx.fillStyle = '#DC143C'; hCtx.beginPath(); hCtx.moveTo(0, -roofH); hCtx.lineTo(-w - 10, 0); hCtx.lineTo(0, h); hCtx.fill();
        hCtx.strokeStyle = '#8B0000'; hCtx.stroke();
        hCtx.strokeStyle = 'rgba(0,0,0,0.15)'; hCtx.lineWidth = 1.5;
        for(let i=1; i<8; i++) {
            hCtx.beginPath(); hCtx.moveTo(-w/8 * i, -roofH + (roofH/8)*i); hCtx.lineTo(-w + (w/8)*i, (h/8)*i); hCtx.stroke();
            hCtx.beginPath(); hCtx.moveTo(w/8 * i, -roofH + (roofH/8)*i); hCtx.lineTo(w - (w/8)*i, (h/8)*i); hCtx.stroke();
        }
        hCtx.fillStyle = '#696969'; hCtx.beginPath(); hCtx.moveTo(w/2 - 5, -roofH/2 - 15); hCtx.lineTo(w/2 + 5, -roofH/2 - 10); hCtx.lineTo(w/2 + 5, -roofH/2 + 15); hCtx.lineTo(w/2 - 5, -roofH/2 + 10); hCtx.fill();
        hCtx.fillStyle = '#A9A9A9'; hCtx.fillRect(w/2 - 6, -roofH/2 - 18, 12, 4);
        hCtx.fillStyle = '#8B4513'; hCtx.beginPath(); hCtx.moveTo(w/2 - 12, wallH/2 - 10); hCtx.lineTo(w - 10, wallH/2 - 20); hCtx.lineTo(w - 10, wallH - 10); hCtx.lineTo(w/2 - 12, wallH); hCtx.fill();
        hCtx.fillStyle = '#FFD700'; hCtx.beginPath(); hCtx.arc(w/2 + 5, wallH/2 + 10, 2, 0, Math.PI*2); hCtx.fill();
        hCtx.fillStyle = '#87CEEB'; hCtx.beginPath(); hCtx.moveTo(-w + 15, wallH/2 - 10); hCtx.lineTo(-w/2 + 10, wallH/2 - 20); hCtx.lineTo(-w/2 + 10, wallH/2 + 10); hCtx.lineTo(-w + 15, wallH/2 + 20); hCtx.fill();
        hCtx.strokeStyle = '#FFF'; hCtx.lineWidth = 3; hCtx.stroke();
        hCtx.beginPath(); hCtx.moveTo(-w/2 - 2, wallH/2 - 22); hCtx.lineTo(-w/2 - 2, wallH/2 + 12); hCtx.stroke();
        hCanvas.refresh();

        // --- 3. ТАЙЛЫ ---
        const stoneCanvas = this.textures.createCanvas('tile_stone', TW, TH);
        const sCtx = stoneCanvas.context;
        sCtx.fillStyle = '#A9A9A9'; sCtx.beginPath(); sCtx.moveTo(TW/2, 0); sCtx.lineTo(TW, TH/2); sCtx.lineTo(TW/2, TH); sCtx.lineTo(0, TH/2); sCtx.fill();
        sCtx.strokeStyle = '#808080'; sCtx.lineWidth = 2; sCtx.stroke();
        sCtx.beginPath(); sCtx.moveTo(TW/4, TH/4); sCtx.lineTo(TW/2, TH/2 + 4); sCtx.stroke();
        stoneCanvas.refresh();

        const dirtCanvas = this.textures.createCanvas('tile_dirt', TW, TH);
        const dCtx = dirtCanvas.context;
        dCtx.fillStyle = '#8B5A2B'; dCtx.beginPath(); dCtx.moveTo(TW/2, 0); dCtx.lineTo(TW, TH/2); dCtx.lineTo(TW/2, TH); dCtx.lineTo(0, TH/2); dCtx.fill();
        dCtx.strokeStyle = '#5C3A21'; dCtx.lineWidth = 1; dCtx.stroke();
        dirtCanvas.refresh();

        const waterCanvas = this.textures.createCanvas('tile_water', TW, TH);
        const wCtx = waterCanvas.context;
        wCtx.fillStyle = '#1E90FF'; wCtx.beginPath(); wCtx.moveTo(TW/2, 0); wCtx.lineTo(TW, TH/2); wCtx.lineTo(TW/2, TH); wCtx.lineTo(0, TH/2); wCtx.fill();
        wCtx.strokeStyle = '#87CEFA'; wCtx.lineWidth = 2;
        wCtx.beginPath(); wCtx.moveTo(TW/4, TH/2); wCtx.lineTo(TW/2, TH/4); wCtx.stroke();
        waterCanvas.refresh();

        // --- 4. ДЕРЕВЬЯ ---
        const tCanvas = this.textures.createCanvas('tree', 120, 160);
        const tCtx = tCanvas.context;
        tCtx.fillStyle = 'rgba(0,0,0,0.3)'; tCtx.beginPath(); tCtx.ellipse(60, 140, 30, 15, 0, 0, Math.PI*2); tCtx.fill();
        tCtx.fillStyle = '#5C4033'; tCtx.fillRect(52, 100, 16, 40);
        tCtx.fillStyle = '#006400'; tCtx.beginPath(); tCtx.arc(60, 80, 45, 0, Math.PI*2); tCtx.fill();
        tCtx.fillStyle = '#228B22'; tCtx.beginPath(); tCtx.arc(40, 60, 35, 0, Math.PI*2); tCtx.fill(); tCtx.beginPath(); tCtx.arc(80, 60, 35, 0, Math.PI*2); tCtx.fill();
        tCtx.fillStyle = '#32CD32'; tCtx.beginPath(); tCtx.arc(60, 45, 30, 0, Math.PI*2); tCtx.fill();
        tCtx.fillStyle = '#7CFC00'; tCtx.beginPath(); tCtx.arc(50, 40, 15, 0, Math.PI*2); tCtx.fill();
        tCanvas.refresh();

        const pCanvas = this.textures.createCanvas('palm', 120, 160);
        const pCtx = pCanvas.context;
        pCtx.fillStyle = 'rgba(0,0,0,0.3)'; pCtx.beginPath(); pCtx.ellipse(60, 140, 20, 10, 0, 0, Math.PI*2); pCtx.fill();
        pCtx.strokeStyle = '#A0522D'; pCtx.lineWidth = 10; pCtx.lineCap = 'round';
        pCtx.beginPath(); pCtx.moveTo(60, 140); pCtx.quadraticCurveTo(80, 80, 50, 40); pCtx.stroke();
        pCtx.fillStyle = '#228B22';
        pCtx.beginPath(); pCtx.ellipse(50, 30, 45, 15, Math.PI/3, 0, Math.PI*2); pCtx.fill();
        pCtx.beginPath(); pCtx.ellipse(50, 30, 45, 15, -Math.PI/3, 0, Math.PI*2); pCtx.fill();
        pCtx.beginPath(); pCtx.ellipse(50, 30, 45, 15, 0, 0, Math.PI*2); pCtx.fill();
        pCtx.fillStyle = '#8B4513'; pCtx.beginPath(); pCtx.arc(50, 30, 8, 0, Math.PI*2); pCtx.fill();
        pCanvas.refresh();

        // --- 5. ДЕКОР ---
        const fCanvas = this.textures.createCanvas('fountain', 160, 140);
        const fCtx = fCanvas.context;
        fCtx.fillStyle = 'rgba(0,0,0,0.3)'; fCtx.beginPath(); fCtx.ellipse(80, 110, 70, 30, 0, 0, Math.PI*2); fCtx.fill();
        fCtx.fillStyle = '#D3D3D3'; fCtx.beginPath(); fCtx.ellipse(80, 90, 70, 35, 0, 0, Math.PI*2); fCtx.fill();
        fCtx.fillStyle = '#1E90FF'; fCtx.beginPath(); fCtx.ellipse(80, 90, 55, 25, 0, 0, Math.PI*2); fCtx.fill();
        fCtx.fillStyle = '#A9A9A9'; fCtx.fillRect(70, 40, 20, 50);
        fCtx.beginPath(); fCtx.ellipse(80, 40, 30, 15, 0, 0, Math.PI*2); fCtx.fill();
        fCtx.fillStyle = '#87CEFA'; fCtx.beginPath(); fCtx.ellipse(80, 35, 25, 10, 0, 0, Math.PI*2); fCtx.fill();
        fCanvas.refresh();

        const lampCanvas = this.textures.createCanvas('lamp', 40, 100);
        const lCtx = lampCanvas.context;
        lCtx.fillStyle = 'rgba(0,0,0,0.3)'; lCtx.beginPath(); lCtx.ellipse(20, 90, 12, 6, 0, 0, Math.PI*2); lCtx.fill();
        lCtx.fillStyle = '#333'; lCtx.fillRect(18, 30, 4, 60);
        lCtx.fillStyle = '#FFD700'; lCtx.beginPath(); lCtx.arc(20, 30, 10, 0, Math.PI*2); lCtx.fill();
        lampCanvas.refresh();

        const benchCanvas = this.textures.createCanvas('bench', 80, 60);
        const bnCtx = benchCanvas.context;
        bnCtx.fillStyle = 'rgba(0,0,0,0.3)'; bnCtx.beginPath(); bnCtx.ellipse(40, 50, 25, 8, 0, 0, Math.PI*2); bnCtx.fill();
        bnCtx.fillStyle = '#8B4513'; bnCtx.fillRect(15, 40, 5, 15); bnCtx.fillRect(60, 40, 5, 15);
        bnCtx.fillStyle = '#A0522D'; bnCtx.beginPath(); bnCtx.moveTo(10, 35); bnCtx.lineTo(70, 35); bnCtx.lineTo(70, 42); bnCtx.lineTo(10, 42); bnCtx.fill();
        bnCtx.beginPath(); bnCtx.moveTo(10, 25); bnCtx.lineTo(70, 25); bnCtx.lineTo(70, 30); bnCtx.lineTo(10, 30); bnCtx.fill();
        benchCanvas.refresh();

        const arrowCanvas = this.textures.createCanvas('arrow_tile', 64, 64);
        const aCtx = arrowCanvas.context;
        aCtx.fillStyle = 'rgba(0, 255, 0, 0.4)'; aCtx.beginPath(); aCtx.ellipse(32, 32, 28, 14, 0, 0, Math.PI * 2); aCtx.fill();
        aCtx.fillStyle = '#00FF00'; aCtx.beginPath();
        aCtx.moveTo(32, 47); aCtx.lineTo(17, 32); aCtx.lineTo(27, 32);
        aCtx.lineTo(27, 17); aCtx.lineTo(37, 17); aCtx.lineTo(37, 32);
        aCtx.lineTo(47, 32); aCtx.closePath(); aCtx.fill();
        arrowCanvas.refresh();

        const partCanvas = this.textures.createCanvas('water_drop', 8, 8);
        const pCtx2 = partCanvas.context;
        pCtx2.fillStyle = '#87CEFA'; pCtx2.beginPath(); pCtx2.arc(4, 4, 4, 0, Math.PI*2); pCtx2.fill();
        partCanvas.refresh();
    }

    buildWorld() {
        if (this.worldGraphics) this.worldGraphics.destroy();
        if (this.arrowsGroup) this.arrowsGroup.clear(true, true);
        if (this.emitters) this.emitters.forEach(e => e.destroy());
        
        // ОЧИСТКА СТАРЫХ ОБЪЕКТОВ ЛОКАЦИИ (исправляет наложение)
        if (this.worldObjects) {
            this.worldObjects.forEach(obj => obj.destroy());
            this.worldObjects = [];
        }

        this.obstacles = [];
        this.emitters = [];
        
        this.worldGraphics = this.add.graphics();
        this.worldGraphics.setDepth(-200); 
        
        this.arrowsGroup = this.add.group();
        
        const locData = this.locations[this.currentLocation];
        const TW = this.tileWidth, TH = this.tileHeight;
        
        this.cameras.main.setBounds(this.bounds.x, this.bounds.y, this.bounds.w, this.bounds.h);
        this.cameras.main.setZoom(1.3);

        this.worldGraphics.lineStyle(1, 0x000000, 0.05);
        for (let row = 0; row < this.mapSize; row++) {
            for (let col = 0; col < this.mapSize; col++) {
                const colorVar = Phaser.Display.Color.ValueToColor(locData.color).brighten(Phaser.Math.Between(-5, 5)).color;
                this.worldGraphics.fillStyle(colorVar, 1);
                
                const x = this.mapCenterX + (col - row) * (TW / 2);
                const y = this.mapCenterY + (col + row - this.mapSize) * (TH / 2);
                
                this.worldGraphics.beginPath();
                this.worldGraphics.moveTo(x, y - TH / 2);
                this.worldGraphics.lineTo(x + TW / 2, y);
                this.worldGraphics.lineTo(x, y + TH / 2);
                this.worldGraphics.lineTo(x - TW / 2, y);
                this.worldGraphics.closePath();
                this.worldGraphics.fillPath();
                this.worldGraphics.strokePath();
            }
        }

        if (this.currentLocation === 'square') {
            this.buildSquare();
        } else if (this.currentLocation === 'forest') {
            this.buildForest();
        } else if (this.currentLocation === 'beach') {
            this.buildBeach();
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
        if (this.myPlayer) this.cameras.main.startFollow(this.myPlayer, true, 0.1, 0.1);
    }

    drawTile(key, col, row) {
        const x = this.mapCenterX + (col - row) * (this.tileWidth / 2);
        const y = this.mapCenterY + (col + row - this.mapSize) * (this.tileHeight / 2);
        let tile = this.add.image(x, y, key).setDepth(-100);
        this.worldObjects.push(tile);
    }

    buildSquare() {
        for(let i=0; i<this.mapSize; i++) {
            this.drawTile('tile_stone', 9, i); 
            this.drawTile('tile_stone', 10, i); 
            this.drawTile('tile_stone', i, 9); 
            this.drawTile('tile_stone', i, 10); 
        }

        this.spawnObject('fountain', 512, 384, 45);
        const emitter = this.add.particles(512, 350, 'water_drop', {
            speed: { min: 20, max: 60 }, angle: { min: 200, max: 340 }, scale: { start: 1, end: 0 }, lifespan: 800, gravityY: 150, frequency: 50
        });
        this.emitters.push(emitter);

        this.spawnObject('house', 300, 200, 50);
        this.spawnObject('house', 724, 200, 50);
        this.spawnObject('house', 300, 568, 50);
        this.spawnObject('house', 724, 568, 50);

        this.spawnObject('lamp', 400, 250, 10);
        this.spawnObject('lamp', 624, 250, 10);
        this.spawnObject('lamp', 400, 518, 10);
        this.spawnObject('lamp', 624, 518, 10);

        this.spawnObject('bench', 350, 384, 20);
        this.spawnObject('bench', 674, 384, 20);
    }

    buildForest() {
        let path = [[9,0], [9,1], [9,2], [8,3], [8,4], [8,5], [9,6], [9,7], [9,8], [9,9], [9,10], [10,11], [10,12], [9,13], [9,14], [9,15], [9,16], [9,17], [9,18], [9,19]];
        path.forEach(p => this.drawTile('tile_dirt', p[0], p[1]));

        const trees = [
            {x: 300, y: 150}, {x: 400, y: 200}, {x: 200, y: 300}, {x: 350, y: 350},
            {x: 650, y: 150}, {x: 750, y: 250}, {x: 800, y: 400}, {x: 700, y: 500},
            {x: 600, y: 600}, {x: 400, y: 650}, {x: 250, y: 550}, {x: 150, y: 450},
            {x: 300, y: 700}, {x: 750, y: 700}, {x: 850, y: 550}
        ];
        trees.forEach(t => this.spawnObject('tree', t.x, t.y, 15));

        this.spawnObject('lamp', 450, 400, 10);
        this.spawnObject('bench', 600, 300, 20);
    }

    buildBeach() {
        for(let row = 0; row < this.mapSize; row++) {
            for(let col = 10; col < this.mapSize; col++) {
                this.drawTile('tile_water', col, row);
            }
        }

        this.spawnObject('palm', 250, 200, 15);
        this.spawnObject('palm', 400, 150, 15);
        this.spawnObject('palm', 600, 650, 15);

        this.spawnObject('bench', 450, 300, 20);
        this.spawnObject('lamp', 300, 500, 10).setTint(0xFF4500);
        this.spawnObject('lamp', 500, 550, 10).setTint(0xFF4500); 
    }

    spawnObject(key, x, y, radius) {
        const obj = this.add.image(x, y, key);
        obj.setOrigin(0.5, 0.9);
        obj.setDepth(y);
        this.obstacles.push({ x, y, r: radius });
        this.worldObjects.push(obj); // Добавляем в массив для очистки
        return obj;
    }

    setupControls() {
        this.input.on('pointerdown', (pointer) => {
            if (pointer.event.target.tagName === 'DIV' || pointer.event.target.tagName === 'BUTTON' || pointer.event.target.tagName === 'INPUT') return;

            if (pointer.leftButtonDown()) {
                let targetX = pointer.worldX;
                let targetY = pointer.worldY;
                
                let isoX = targetX - this.mapCenterX;
                let isoY = targetY - this.mapCenterY + (this.mapSize * this.tileHeight/2);
                
                let col = (isoX / (this.tileWidth/2) + isoY / (this.tileHeight/2)) / 2;
                let row = (isoY / (this.tileHeight/2) - isoX / (this.tileWidth/2)) / 2;
                
                col = Phaser.Math.Clamp(col, 0, this.mapSize - 1);
                row = Phaser.Math.Clamp(row, 0, this.mapSize - 1);
                
                this.targetX = this.mapCenterX + (col - row) * (this.tileWidth/2);
                this.targetY = this.mapCenterY + (col + row - this.mapSize) * (this.tileHeight/2);
                
                this.createClickMarker(this.targetX, this.targetY);
            }
        });
    }

    createClickMarker(x, y) {
        const marker = this.add.ellipse(x, y, 20, 10, 0x00FF00, 0.8);
        marker.setDepth(y);
        this.tweens.add({
            targets: marker, alpha: 0, scaleX: 2, scaleY: 2, duration: 400, onComplete: () => marker.destroy()
        });
    }

    connectToServer() {
        const username = sessionStorage.getItem('katiki_username') || 'Гость';
        this.ws = new WebSocket(`wss://katiki-game.katiland.workers.dev/ws?username=${encodeURIComponent(username)}`);

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            // ОБРАБОТКА ОШИБКИ ДУБЛИКАТА СЕРВЕРА
            if (data.type === 'error') {
                alert(data.message);
                sessionStorage.clear();
                localStorage.removeItem('katiki_username');
                window.location.reload();
                return;
            }

            if (data.type === 'init') {
                this.myId = data.id;
                if (data.location) this.currentLocation = data.location;
                this.buildWorld();
                
                if (!this.myPlayer) {
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
                
                let alreadyStuck = false;
                for (let obs of this.obstacles) {
                    if (Phaser.Math.Distance.Between(this.myPlayer.x, this.myPlayer.y, obs.x, obs.y) < obs.r + 5) {
                        alreadyStuck = true;
                        break;
                    }
                }

                let canMove = true;
                if (!alreadyStuck) {
                    for (let obs of this.obstacles) {
                        const distToObs = Phaser.Math.Distance.Between(nextX, nextY, obs.x, obs.y);
                        if (distToObs < obs.r + 12) { canMove = false; break; }
                    }
                }
                
                if (canMove) {
                    this.myPlayer.x = Phaser.Math.Clamp(nextX, this.bounds.x + 20, this.bounds.x + this.bounds.w - 20);
                    this.myPlayer.y = Phaser.Math.Clamp(nextY, this.bounds.y + 20, this.bounds.y + this.bounds.h - 20);
                    
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
                        // Сохраняем данные в localStorage (для БД)
                        localStorage.setItem('katiki_username', data.username);
                        localStorage.setItem('katiki_fluffies', data.fluffies);
                        localStorage.setItem('katiki_inventory', JSON.stringify(data.inventory));
                        
                        // Сохраняем в sessionStorage (для активной сессии этой вкладки)
                        sessionStorage.setItem('katiki_username', data.username);
                        sessionStorage.setItem('katiki_active_session', 'true');

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