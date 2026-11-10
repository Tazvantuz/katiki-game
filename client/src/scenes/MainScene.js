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
    }

    preload() {}

    create() {
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
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = this.input.keyboard.addKeys('W,A,S,D');
    }

    connectToServer() {
        // Боевой адрес сервера с твоим новым субдоменом
        this.ws = new WebSocket('wss://katiki-game.katiland.workers.dev/ws');

        this.ws.onopen = () => {
            console.log('Подключено к серверу!');
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'init') {
                this.myId = data.id;
                this.createPlayer(this.myId, 512, 384, 0x0000FF, 'Вы');

                data.players.forEach(p => {
                    this.createPlayer(p.id, p.x, p.y, 0xFF0000, 'Игрок');
                });
            } 
            else if (data.type === 'player_joined') {
                this.createPlayer(data.player.id, data.player.x, data.player.y, 0xFF0000, 'Игрок');
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

    createPlayer(id, x, y, color, name) {
        const container = this.add.container(x, y);
        const body = this.add.circle(0, 0, 15, color);
        body.setStrokeStyle(2, 0x000000);
        const text = this.add.text(0, -30, name, { fontSize: '14px', fill: '#fff', backgroundColor: '#00000088', padding: {x:4, y:2} }).setOrigin(0.5);

        container.add([body, text]);
        container.setDepth(y);

        if (id === this.myId) {
            this.myPlayer = container;
        } else {
            this.otherPlayers[id] = container;
        }
    }

    update(time, delta) {
        if (!this.myPlayer) return;

        let dx = 0;
        let dy = 0;

        if (this.cursors.left.isDown || this.keys.A.isDown) dx -= 1;
        if (this.cursors.right.isDown || this.keys.D.isDown) dx += 1;
        if (this.cursors.up.isDown || this.keys.W.isDown) dy -= 1;
        if (this.cursors.down.isDown || this.keys.S.isDown) dy += 1;

        if (dx !== 0 || dy !== 0) {
            this.myPlayer.x += dx * this.speed;
            this.myPlayer.y += dy * this.speed;
            this.myPlayer.setDepth(this.myPlayer.y);

            if (time - this.lastSendTime > 50) {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({
                        type: 'move',
                        x: Math.round(this.myPlayer.x),
                        y: Math.round(this.myPlayer.y)
                    }));
                }
                this.lastSendTime = time;
            }
        }
    }
}