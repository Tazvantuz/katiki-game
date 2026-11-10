// client/src/main.js
import Phaser from 'phaser';
import MainScene from './scenes/MainScene.js';
import UIScene from './scenes/UIScene.js';

const config = {
    type: Phaser.AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    backgroundColor: '#87CEEB',
    scene: [MainScene, UIScene], // UIScene запускается поверх MainScene
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    dom: {
        createContainer: true
    },
    render: {
        antialias: true,
        roundPixels: true
    }
};

const game = new Phaser.Game(config);