import Phaser from 'phaser';
import MainScene from './scenes/MainScene.js';

const config = {
    type: Phaser.AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    backgroundColor: '#87CEEB',
    scene: [MainScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    dom: {
        createContainer: true // Включаем поддержку HTML-элементов
    }
};

const game = new Phaser.Game(config);