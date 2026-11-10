// client/src/main.js
import Phaser from 'phaser';
import MainScene from './scenes/MainScene.js';
import UIScene from './scenes/UIScene.js';

const config = {
    type: Phaser.AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    backgroundColor: '#1a1a2e',
    scene: [MainScene, UIScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    dom: {
        createContainer: true
    },
    input: {
        activePointers: 1
    },
    render: {
        antialias: true,
        roundPixels: true
    }
};

const game = new Phaser.Game(config);