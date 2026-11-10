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
        
        // Карта 20x20 тайлов
        this.mapSize = 20;
        this.tileWidth = 64;
        this.tileHeight = 32;
        this.mapCenterX = 512;
        this.mapCenterY = 384;

        // Жесткие рамки для камеры и персонажа
        this.bounds = { x: -128, y: 64, w: 1280, h: 640 };

        this.locations = {
            'square': { name: 'Центральная площадь', desc: 'Сердце города', color: 0x90EE90, arrowTo: [{ id: 'forest', x: 512, y: 650 }] },
            'forest': { name: 'Изумрудный лес', desc: 'Тихое место', color: 0x2E8B57, arrowTo: [{ id: 'square', x: 512, y: 200 }, { id: 'beach', x: 850, y: 400 }] },
            'beach': { name: 'Солнечный пляж', desc: 'Море и песок', color: 0xF4A460, arrowTo: [{ id: 'forest', x: 200, y: 400 }] }
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

        // --- 2. ДОМ (Идеальная изометрия) ---
        const hCanvas = this.textures.createCanvas('house', 180, 200);
        const hCtx = hCanvas.context;
        hCtx.translate(90, 100);
        const w = 50, h = 25, wallH = 60, roofH = 40;
        
        hCtx.fillStyle = 'rgba(0,0,0,0.25)'; hCtx.beginPath(); hCtx.ellipse(0, h + wallH, w + 10, h + 10, 0, 0, Math.PI*2); hCtx.fill();
        hCtx.fillStyle = '#FDF5E6'; hCtx.beginPath(); hCtx.moveTo(-w, 0); hCtx.lineTo(0, h); hCtx.lineTo(0, h + wallH); hCtx.lineTo(-w, wallH); hCtx.fill();
        hCtx.fillStyle = '#DEB887'; hCtx.beginPath(); hCtx.moveTo(0, h); hCtx.lineTo(w, 0); hCtx.lineTo(w, wallH); hCtx.lineTo(0, h + wallH); hCtx.fill();
        hCtx.fillStyle = '#8B0000'; hCtx.beginPath(); hCtx.moveTo(0, -roofH); hCtx.lineTo(w + 10, 0); hCtx.lineTo(0, h); hCtx.fill();
        hCtx.fillStyle = '#B22222'; hCtx.beginPath(); hCtx.moveTo(0, -roofH); hCtx.lineTo(-w - 10, 0); hCtx.lineTo(0, h); hCtx.fill();
        
        hCtx.strokeStyle = 'rgba(0,0,0,0.1)'; hCtx.lineWidth = 2;
        for(let i=1; i<6; i++) {
            hCtx.beginPath(); hCtx.moveTo(-w/6 * i, -roofH + (roofH/6)*i); hCtx.lineTo(-w + (w/6)*i, (h/6)*i); hCtx.stroke();
            hCtx.beginPath(); hCtx.moveTo(w/6 * i, -roofH + (roofH/6)*i); hCtx.lineTo(w - (w/6)*i, (h/6)*i); hCtx.stroke();
        }
        hCtx.fillStyle = '#696969'; hCtx.beginPath(); hCtx.moveTo(w/2 - 5, -roofH/2 - 10); hCtx.lineTo(w/2 + 5, -roofH/2 - 5); hCtx.lineTo(w/2 + 5, -roofH/2 + 15); hCtx.lineTo(w/2 - 5, -roofH/2 + 10); hCtx.fill();
        hCtx.fillStyle = '#5C4033'; hCtx.beginPath(); hCtx.moveTo(w/2 - 10, wallH/2 - 10); hCtx.lineTo(w - 5, wallH/2 - 15); hCtx.lineTo(w - 5, wallH - 15); hCtx.lineTo(w/2 - 10, wallH - 10); hCtx.fill();
        hCtx.fillStyle = '#87CEEB'; hCtx.beginPath(); hCtx.moveTo(-w + 10, wallH/2 - 5); hCtx.lineTo(-w/2 + 5, wallH/2 - 15); hCtx.lineTo(-w/2 + 5, wallH/2 + 5); hCtx.lineTo(-w + 10, wallH/2 + 15); hCtx.fill();
        hCanvas.refresh();

        // --- 3. ДЕРЕВЬЯ И КУСТЫ ---
        const tCanvas = this.textures.createCanvas('tree', 120, 160);
        const tCtx = tCanvas.context;
        tCtx.fillStyle = 'rgba(0,0,0,0.25)'; tCtx.beginPath(); tCtx.ellipse(60, 140, 40, 15, 0, 0, Math.PI*2); tCtx.fill();
        tCtx.fillStyle = '#5C4033'; tCtx.fillRect(50, 90, 20, 50);
        tCtx.fillStyle = '#228B22'; tCtx.beginPath(); tCtx.arc(60, 80, 45, 0, Math.PI*2); tCtx.fill();
        tCtx.fillStyle = '#2E8B57'; tCtx.beginPath(); tCtx.arc(45, 60, 35, 0, Math.PI*2); tCtx.fill(); tCtx.beginPath(); tCtx.arc(75, 60, 35, 0, Math.PI*2); tCtx.fill();
        tCtx.fillStyle = '#3CB371'; tCtx.beginPath(); tCtx.arc(60, 45, 30, 0, Math.PI*2); tCtx.fill();
        tCtx.fillStyle = '#90EE90'; tCtx.beginPath(); tCtx.arc(50, 40, 15, 0, Math.PI*2); tCtx.fill();
        tCanvas.refresh();

        const bCanvas = this.textures.createCanvas('bush', 64, 48);
        const bCtx = bCanvas.context;
        bCtx.fillStyle = 'rgba(0,0,0,0.2)'; bCtx.beginPath(); bCtx.ellipse(32, 40, 20, 8, 0, 0, Math.PI*2); bCtx.fill();
        bCtx.fillStyle = '#2E8B57'; bCtx.beginPath(); bCtx.arc(20, 30, 15, 0, Math.PI*2); bCtx.fill();
        bCtx.beginPath(); bCtx.arc(44, 30, 15, 0, Math.PI*2); bCtx.fill();
        bCtx.fillStyle = '#3CB371'; bCtx.beginPath(); bCtx.arc(32, 20, 18, 0, Math.PI*2); bCtx.fill();
        bCanvas.refresh();

        // --- 4. ДЕКОР ---
        const lCanvas = this.textures.createCanvas('lamp', 40, 100);
        const lCtx = lCanvas.context;
        lCtx.fillStyle = 'rgba(0,0,0,0.2)'; lCtx.beginPath(); lCtx.ellipse(20, 90, 15, 8, 0, 0, Math.PI*2); lCtx.fill();
        lCtx.fillStyle = '#333'; lCtx.fillRect(18, 30, 4, 60);
        lCtx.fillStyle = '#FFD700'; lCtx.beginPath(); lCtx.arc(20, 30, 10, 0, Math.PI*2); lCtx.fill();
        lCtx.fillStyle = '#FFF'; lCtx.beginPath(); lCtx.arc(18, 28, 4, 0, Math.PI*2); lCtx.fill();
        lCanvas.refresh();

        const benchCanvas = this.textures.createCanvas('bench', 80, 60);
        const bnCtx = benchCanvas.context;
        bnCtx.fillStyle = 'rgba(0,0,0,0.2)'; bnCtx.beginPath(); bnCtx.ellipse(40, 50, 30, 10, 0, 0, Math.PI*2); bnCtx.fill();
        bnCtx.fillStyle = '#8B4513'; bnCtx.fillRect(15, 40, 5, 15); bnCtx.fillRect(60, 40, 5, 15);
        bnCtx.fillStyle = '#A0522D'; bnCtx.beginPath(); bnCtx.moveTo(10, 35); bnCtx.lineTo(70, 35); bnCtx.lineTo(70, 42); bnCtx.lineTo(10, 42); bnCtx.fill();
        bnCtx.beginPath(); bnCtx.moveTo(10, 25); bnCtx.lineTo(70, 25); bnCtx.lineTo(70, 30); bnCtx.lineTo(10, 30); bnCtx.fill();
        benchCanvas.refresh();

        const rockCanvas = this.textures.createCanvas('rock', 64, 48);
        const rCtx = rockCanvas.context;
        rCtx.fillStyle = 'rgba(0,0,0,0.2)'; rCtx.beginPath(); rCtx.ellipse(32, 40, 20, 8, 0, 0, Math.PI*2); rCtx.fill();
        rCtx.fillStyle = '#808080'; rCtx.beginPath(); rCtx.ellipse(32, 30, 20, 15, 0, 0, Math.PI*2); rCtx.fill();
        rCtx.fillStyle = '#A9A9A9'; rCtx.beginPath(); rCtx.ellipse(28, 25, 12, 8, 0, 0, Math.PI*2); rCtx.fill();
        rockCanvas.refresh();

        // --- 5. ТАЙЛЫ ---
        const pathCanvas = this.textures.createCanvas('path_tile', TW, TH);
        const pCtx = pathCanvas.context;
        pCtx.fillStyle = 'rgba(200, 180, 140, 0.9)';
        pCtx.beginPath(); pCtx.moveTo(TW/2, 0); pCtx.lineTo(TW, TH/2); pCtx.lineTo(TW/2, TH); pCtx.lineTo(0, TH/2); pCtx.fill();
        pCtx.strokeStyle = 'rgba(0,0,0,0.1)'; pCtx.lineWidth = 1; pCtx.stroke();
        pathCanvas.refresh();

        const waterCanvas = this.textures.createCanvas('water_tile', TW, TH);
        const wCtx = waterCanvas.context;
        wCtx.fillStyle = 'rgba(64, 164, 223, 0.8)';
        wCtx.beginPath(); wCtx.moveTo(TW/2, 0); wCtx.lineTo(TW, TH/2); wCtx.lineTo(TW/2, TH); wCtx.lineTo(0, TH/2); wCtx.fill();
        waterCanvas.refresh();

        const fountCanvas = this.textures.createCanvas('fountain', 160, 140);
        const fCtx = fountCanvas.context;
        fCtx.fillStyle = 'rgba(0,0,0,0.25)'; fCtx.beginPath(); fCtx.ellipse(80, 110, 70, 30, 0, 0, Math.PI*2); fCtx.fill();
        fCtx.fillStyle = '#D3D3D3'; fCtx.beginPath(); fCtx.ellipse(80, 90, 70, 35, 0, 0, Math.PI*2); fCtx.fill();
        fCtx.fillStyle = '#4682B4'; fCtx.beginPath(); fCtx.ellipse(80, 90, 55, 25, 0, 0, Math.PI*2); fCtx.fill();
        fCtx.fillStyle = '#A9A9A9'; fCtx.fillRect(70, 40, 20, 50);
        fCtx.beginPath(); fCtx.ellipse(80, 40, 30, 15, 0, 0, Math.PI*2); fCtx.fill();
        fCtx.fillStyle = '#87CEFA'; fCtx.beginPath(); fCtx.ellipse(80, 35, 25, 10, 0, 0, Math.PI*2); fCtx.fill();
        fountCanvas.refresh();

        const size = 64;
        const arrowCanvas = this.textures.createCanvas('arrow_tile', size, size);
        const aCtx = arrowCanvas.context;
        aCtx.fillStyle = 'rgba(0, 255, 0, 0.4)'; aCtx.beginPath(); aCtx.ellipse(size/2, size/2, 28, 14, 0, 0, Math.PI * 2); aCtx.fill();
        aCtx.fillStyle = '#00FF00'; aCtx.beginPath();
        aCtx.moveTo(size/2, size/2 + 15); aCtx.lineTo(size/2 - 15, size/2); aCtx.lineTo(size/2 - 5, size/2);
        aCtx.lineTo(size/2 - 5, size/2 - 15); aCtx.lineTo(size/2 + 5, size/2 - 15); aCtx.lineTo(size/2 + 5, size/2);
        aCtx.lineTo(size/2 + 15, size/2); aCtx.closePath(); aCtx.fill();
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
        
        this.obstacles = [];
        this.emitters = [];
        this.worldGraphics = this.add.graphics();
        this.arrowsGroup = this.add.group();
        
        const locData = this.locations[this.currentLocation];
        const TW = this.tileWidth, TH = this.tileHeight;
        
        // Камера жестко зафиксирована в рамках карты
        this.cameras.main.setBounds(this.bounds.x, this.bounds.y, this.bounds.w, this.bounds.h);
        this.cameras.main.setZoom(1.3);

        // Отрисовка пола
        this.worldGraphics.lineStyle(1, 0x000000, 0.1);
        for (let row = 0; row < this.mapSize; row++) {
            for (let col = 0; col < this.mapSize; col++) {
                const colorVar = Phaser.Display.Color.ValueToColor(locData.color).brighten(Phaser.Math.Between(-10, 10)).color;
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

        // ФИКСИРОВАННЫЕ ЛОКАЦИИ (Одинаковые для всех игроков)
        if (this.currentLocation === 'square') {
            this.buildSquare();
        } else if (this.currentLocation === 'forest') {
            this.buildForest();
        } else if (this.currentLocation === 'beach') {
            this.buildBeach();
        }

        // Стрелки
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

    // --- УНИКАЛЬНЫЕ ЛОКАЦИИ ---
    buildSquare() {
        // Дорожки
        for(let i=4; i<16; i++) {
            let x1 = this.mapCenterX + (i - 10) * 32;
            let y1 = this.mapCenterY + (i + 10 - 20) * 16;
            this.add.image(x1, y1, 'path_tile').setDepth(-100);
            
            let x2 = this.mapCenterX + (10 - i) * 32;
            let y2 = this.mapCenterY + (10 + i - 20) * 16;
            this.add.image(x2, y2, 'path_tile').setDepth(-100);
        }

        this.spawnObject('fountain', 512, 384, 50);
        const emitter = this.add.particles(512, 350, 'water_drop', {
            speed: { min: 20, max: 60 }, angle: { min: 200, max: 340 }, scale: { start: 1, end: 0 }, lifespan: 800, gravityY: 150, frequency: 50
        });
        this.emitters.push(emitter);

        // Жестко заданные координаты
        const houses = [{x: 300, y: 250}, {x: 700, y: 250}, {x: 300, y: 550}, {x: 700, y: 550}];
        houses.forEach(h => this.spawnObject('house', h.x, h.y, 60));

        const lamps = [{x: 400, y: 300}, {x: 600, y: 300}, {x: 400, y: 480}, {x: 600, y: 480}];
        lamps.forEach(l => this.spawnObject('lamp', l.x, l.y, 15));

        const benches = [{x: 350, y: 400}, {x: 650, y: 400}];
        benches.forEach(b => this.spawnObject('bench', b.x, b.y, 25));
    }

    buildForest() {
        // Тропинка
        for(let i=5; i<15; i++) {
            let x = this.mapCenterX + (i - 10) * 32;
            let y = this.mapCenterY + (i + 10 - 20) * 16;
            this.add.image(x, y, 'path_tile').setDepth(-100).setTint(0x8B4513);
        }

        // Детерминированный генератор (все игроки видят одинаковый лес)
        let seed = 12345;
        const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

        for(let i=0; i<40; i++) {
            let tx = 100 + rand() * 800;
            let ty = 100 + rand() * 500;
            // Ограничение спавна вокруг тропинки
            if (Phaser.Math.Distance.Between(tx, ty, 512, 450) > 120 && Phaser.Math.Distance.Between(tx, ty, 512, 600) > 120) {
                this.spawnObject('tree', tx, ty, 30);
            }
        }
        
        for(let i=0; i<10; i++) {
            let bx = 100 + rand() * 800;
            let by = 100 + rand() * 500;
            this.spawnObject('bush', bx, by, 15);
        }
        for(let i=0; i<5; i++) {
            let rx = 100 + rand() * 800;
            let ry = 100 + rand() * 500;
            this.spawnObject('rock', rx, ry, 15);
        }
    }

    buildBeach() {
        // Вода (верхние 8 рядов)
        for(let row = 0; row < 8; row++) {
            for(let col = 0; col < 20; col++) {
                const x = this.mapCenterX + (col - row) * 32;
                const y = this.mapCenterY + (col + row - 20) * 16;
                this.add.image(x, y, 'water_tile').setDepth(-100);
            }
        }

        const trees = [{x: 200, y: 500}, {x: 300, y: 700}, {x: 600, y: 650}];
        trees.forEach(t => this.spawnObject('tree', t.x, t.y, 30));
        
        const benches = [{x: 450, y: 500}];
        benches.forEach(b => this.spawnObject('bench', b.x, b.y, 25));

        const rocks = [{x: 700, y: 600}, {x: 800, y: 500}];
        rocks.forEach(r => this.spawnObject('rock', r.x, r.y, 15));
        
        // Зонтики (лампы перекрашенные)
        const umbrellas = [{x: 350, y: 550}, {x: 650, y: 500}];
        umbrellas.forEach(u => this.spawnObject('lamp', u.x, u.y, 15).setTint(0xFF0000));
    }

    spawnObject(key, x, y, radius) {
        const obj = this.add.image(x, y, key);
        obj.setOrigin(0.5, 0.9);
        obj.setDepth(y);
        this.obstacles.push({ x, y, r: radius });
        return obj;
    }

    setupControls() {
        this.input.on('pointerdown', (pointer) => {
            if (pointer.event.target.tagName === 'DIV' || pointer.event.target.tagName === 'BUTTON' || pointer.event.target.tagName === 'INPUT') return;

            if (pointer.leftButtonDown()) {
                let targetX = pointer.worldX;
                let targetY = pointer.worldY;
                
                // Перевод в изометрические координаты
                let isoX = targetX - this.mapCenterX;
                let isoY = targetY - this.mapCenterY + (this.mapSize * this.tileHeight/2);
                
                let col = (isoX / (this.tileWidth/2) + isoY / (this.tileHeight/2)) / 2;
                let row = (isoY / (this.tileHeight/2) - isoX / (this.tileWidth/2)) / 2;
                
                // Жестко зажимаем клик в рамках карты
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
                
                // Защита от застревания
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
                    // Жесткое ограничение координат (Clamp), чтобы не выйти за карту
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