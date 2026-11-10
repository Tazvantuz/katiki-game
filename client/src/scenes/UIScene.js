// client/src/scenes/UIScene.js
import Phaser from 'phaser';

export default class UIScene extends Phaser.Scene {
    constructor() {
        super({ key: 'UIScene', active: false });
        this.chatMessages = [];
    }

    create() {
        this.createTopBar();
        this.createBottomBar();
        this.createChat();
        this.createModals();

        // Слушаем события от MainScene
        this.game.events.on('updateCurrency', (fluffies) => {
            const el = document.getElementById('currency-amount');
            if (el) {
                el.innerText = fluffies;
                // Анимация прибавления
                el.parentElement.classList.add('bump');
                setTimeout(() => el.parentElement.classList.remove('bump'), 300);
            }
        });

        this.game.events.on('newChatMessage', (data) => {
            this.addChatMessage(data.name, data.text, data.color);
        });

        this.game.events.on('updateLocationName', (name) => {
            const el = document.getElementById('current-location');
            if (el) el.innerText = name;
        });
    }

    createTopBar() {
        const html = `
            <style>
                .ui-top {
                    position: absolute; top: 0; left: 0; width: 100%; pointer-events: none;
                    display: flex; justify-content: space-between; padding: 15px; box-sizing: border-box;
                    font-family: 'Nunito', sans-serif;
                }
                .location-badge {
                    pointer-events: auto; background: rgba(0, 0, 0, 0.6); color: white;
                    padding: 8px 20px; border-radius: 20px; font-weight: 800; font-size: 18px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.3); backdrop-filter: blur(5px);
                    border: 1px solid rgba(255,255,255,0.2);
                    display: flex; align-items: center; gap: 10px;
                }
                .location-badge::before { content: '📍'; font-size: 20px; }
                
                .currency-panel {
                    pointer-events: auto; background: linear-gradient(135deg, #FFD700, #FFA500);
                    padding: 8px 20px; border-radius: 20px; color: #fff; font-weight: 800;
                    display: flex; align-items: center; gap: 10px; font-size: 18px;
                    box-shadow: 0 4px 15px rgba(255, 165, 0, 0.4);
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.3); transition: transform 0.2s;
                }
                .currency-panel.bump { transform: scale(1.1); }
                .currency-icon { font-size: 24px; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3)); }
            </style>
            <div class="ui-top">
                <div class="location-badge"><span id="current-location">Загрузка...</span></div>
                <div class="currency-panel">
                    <span class="currency-icon">🪙</span>
                    <span id="currency-amount">0</span>
                    <span style="font-size: 12px; opacity: 0.8; margin-left: 5px;">Пушистиков</span>
                </div>
            </div>
        `;
        this.add.dom(512, 0).createFromHTML(html);
    }

    createBottomBar() {
        const html = `
            <style>
                .ui-bottom {
                    position: absolute; bottom: 15px; left: 15px; pointer-events: auto;
                    display: flex; flex-direction: column; gap: 10px; font-family: 'Nunito', sans-serif;
                }
                .menu-btn {
                    width: 60px; height: 60px; border-radius: 20px; border: none; cursor: pointer;
                    background: rgba(255, 255, 255, 0.9); box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                    font-size: 28px; display: flex; justify-content: center; align-items: center;
                    transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                .menu-btn:hover { transform: scale(1.1) translateY(-5px); background: #fff; box-shadow: 0 10px 20px rgba(0,0,0,0.3); }
                .menu-btn:active { transform: scale(0.95); }
            </style>
            <div class="ui-bottom">
                <button class="menu-btn" id="btn-map" title="Карта">🗺️</button>
                <button class="menu-btn" id="btn-inv" title="Инвентарь">🎒</button>
                <button class="menu-btn" id="btn-friends" title="Друзья">👥</button>
                <button class="menu-btn" id="btn-profile" title="Профиль">⚙️</button>
            </div>
        `;
        const dom = this.add.dom(0, 0).createFromHTML(html);
        
        dom.getChildByID('btn-map').addEventListener('click', () => this.toggleModal('modal-map'));
        dom.getChildByID('btn-inv').addEventListener('click', () => this.toggleModal('modal-inv'));
        dom.getChildByID('btn-friends').addEventListener('click', () => this.toggleModal('modal-friends'));
        dom.getChildByID('btn-profile').addEventListener('click', () => this.toggleModal('modal-profile'));
    }

    createChat() {
        const html = `
            <style>
                .chat-container {
                    position: absolute; bottom: 15px; left: 90px; width: 350px; pointer-events: auto;
                    font-family: 'Nunito', sans-serif; display: flex; flex-direction: column;
                }
                .chat-messages {
                    height: 150px; overflow-y: auto; display: flex; flex-direction: column; gap: 5px;
                    margin-bottom: 10px; mask-image: linear-gradient(to bottom, transparent, black 20%);
                    -webkit-mask-image: linear-gradient(to bottom, transparent, black 20%);
                    padding-top: 20px; scrollbar-width: none;
                }
                .chat-messages::-webkit-scrollbar { display: none; }
                .chat-msg {
                    background: rgba(0, 0, 0, 0.5); color: white; padding: 6px 12px; border-radius: 12px;
                    font-size: 14px; backdrop-filter: blur(5px); width: fit-content; max-width: 90%;
                    animation: slideInMsg 0.3s ease-out forwards;
                }
                @keyframes slideInMsg { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .chat-msg b { color: #FFD700; margin-right: 5px; }
                
                .chat-input-wrapper {
                    display: flex; background: rgba(255, 255, 255, 0.9); border-radius: 20px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.2); overflow: hidden;
                    border: 2px solid transparent; transition: border 0.3s;
                }
                .chat-input-wrapper:focus-within { border-color: #4CAF50; background: #fff; }
                .chat-input {
                    flex: 1; border: none; padding: 10px 15px; font-family: 'Nunito', sans-serif;
                    font-size: 14px; background: transparent; outline: none; color: #333;
                }
                .chat-send {
                    background: #4CAF50; border: none; color: white; padding: 0 15px; cursor: pointer;
                    font-weight: 800; transition: background 0.2s;
                }
                .chat-send:hover { background: #45a049; }
            </style>
            <div class="chat-container">
                <div class="chat-messages" id="chat-messages"></div>
                <div class="chat-input-wrapper">
                    <input type="text" class="chat-input" id="chat-input" placeholder="Написать сообщение..." maxlength="100">
                    <button class="chat-send" id="chat-send">➤</button>
                </div>
            </div>
        `;
        const dom = this.add.dom(0, 0).createFromHTML(html);
        
        const input = dom.getChildByID('chat-input');
        const sendBtn = dom.getChildByID('chat-send');

        const sendMessage = () => {
            const text = input.value.trim();
            if (text) {
                this.game.events.emit('sendChatMessage', text);
                input.value = '';
            }
        };

        sendBtn.addEventListener('click', sendMessage);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    addChatMessage(name, text, color = '#FFD700') {
        const container = document.getElementById('chat-messages');
        if (!container) return;
        
        const msg = document.createElement('div');
        msg.className = 'chat-msg';
        msg.innerHTML = `<b style="color: ${color}">${name}:</b> ${text}`;
        container.appendChild(msg);
        
        // Автоскролл вниз
        container.scrollTop = container.scrollHeight;
        
        // Ограничиваем количество сообщений в DOM
        if (container.children.length > 50) {
            container.removeChild(container.firstChild);
        }
    }

    createModals() {
        const html = `
            <style>
                .modal-overlay {
                    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.6); backdrop-filter: blur(5px);
                    display: none; justify-content: center; align-items: center; pointer-events: auto;
                    z-index: 1000; font-family: 'Nunito', sans-serif;
                }
                .modal-overlay.active { display: flex; animation: fadeIn 0.3s forwards; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                
                .modal-content {
                    background: linear-gradient(135deg, #ffffff, #f0f0f0); width: 600px; height: 400px;
                    border-radius: 30px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                    display: flex; flex-direction: column; overflow: hidden;
                    animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                    border: 4px solid #fff;
                }
                @keyframes popIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                
                .modal-header {
                    padding: 20px; background: #FF9A9E; color: white; font-size: 24px;
                    font-weight: 800; display: flex; justify-content: space-between; align-items: center;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
                }
                .modal-close {
                    background: rgba(255,255,255,0.3); border: none; color: white; width: 35px; height: 35px;
                    border-radius: 50%; font-size: 20px; cursor: pointer; transition: all 0.2s;
                }
                .modal-close:hover { background: rgba(255,255,255,0.5); transform: rotate(90deg); }
                
                .modal-body { flex: 1; padding: 20px; overflow-y: auto; }
                
                /* Карта */
                .map-locations { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
                .map-card {
                    background: white; border-radius: 20px; padding: 20px; text-align: center;
                    cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                    border: 2px solid transparent;
                }
                .map-card:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.15); border-color: #4CAF50; }
                .map-card h3 { margin: 0 0 10px 0; color: #333; }
                .map-card p { margin: 0; color: #666; font-size: 12px; }
                
                /* Инвентарь */
                .inventory-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
                .inv-slot {
                    aspect-ratio: 1; background: #e0e0e0; border-radius: 15px;
                    display: flex; justify-content: center; align-items: center;
                    font-size: 30px; box-shadow: inset 0 2px 5px rgba(0,0,0,0.1);
                }
                .inv-slot.empty { opacity: 0.5; }
                
                /* Профиль */
                .profile-info { display: flex; gap: 20px; align-items: center; }
                .profile-avatar { width: 100px; height: 100px; background: #FFD700; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 50px; }
                .profile-details h2 { margin: 0 0 10px 0; }
                .profile-details p { margin: 5px 0; color: #666; }
            </style>

            <!-- Модальное окно: КАРТА -->
            <div class="modal-overlay" id="modal-map">
                <div class="modal-content">
                    <div class="modal-header">
                        <span>🗺️ Карта мира</span>
                        <button class="modal-close" data-close="modal-map">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="map-locations" id="map-list">
                            <!-- Заполняется динамически -->
                        </div>
                    </div>
                </div>
            </div>

            <!-- Модальное окно: ИНВЕНТАРЬ -->
            <div class="modal-overlay" id="modal-inv">
                <div class="modal-content">
                    <div class="modal-header" style="background: #2196F3;">
                        <span>🎒 Инвентарь</span>
                        <button class="modal-close" data-close="modal-inv">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="inventory-grid">
                            <div class="inv-slot">🍎</div>
                            <div class="inv-slot">🍣</div>
                            <div class="inv-slot">🎩</div>
                            <div class="inv-slot empty">+</div>
                            <div class="inv-slot empty">+</div>
                            <div class="inv-slot empty">+</div>
                            <div class="inv-slot empty">+</div>
                            <div class="inv-slot empty">+</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Модальное окно: ПРОФИЛЬ -->
            <div class="modal-overlay" id="modal-profile">
                <div class="modal-content">
                    <div class="modal-header" style="background: #4CAF50;">
                        <span>⚙️ Профиль</span>
                        <button class="modal-close" data-close="modal-profile">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="profile-info">
                            <div class="profile-avatar">🐱</div>
                            <div class="profile-details">
                                <h2 id="profile-name">Загрузка...</h2>
                                <p>Уровень: 1</p>
                                <p>Статус: Исследователь</p>
                            </div>
                        </div>
                        <div style="margin-top: 20px;">
                            <button style="width: 100%; padding: 15px; background: #F44336; color: white; border: none; border-radius: 15px; font-weight: 800; cursor: pointer;" onclick="localStorage.removeItem('katiki_username'); window.location.reload();">Выйти из аккаунта</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Модальное окно: ДРУЗЬЯ -->
            <div class="modal-overlay" id="modal-friends">
                <div class="modal-content">
                    <div class="modal-header" style="background: #9C27B0;">
                        <span>👥 Друзья</span>
                        <button class="modal-close" data-close="modal-friends">×</button>
                    </div>
                    <div class="modal-body">
                        <p style="text-align: center; color: #666;">Список друзей пока пуст. Добавляйте других игроков!</p>
                    </div>
                </div>
            </div>
        `;

        this.add.dom(0, 0).createFromHTML(html);

        // Обработка закрытия
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = e.target.getAttribute('data-close');
                document.getElementById(modalId).classList.remove('active');
            });
        });

        // Заполняем профиль
        const username = localStorage.getItem('katiki_username') || 'Гость';
        document.getElementById('profile-name').innerText = username;

        // Заполняем карту (локации будут добавлены позже через события)
        this.game.events.on('initMap', (locations, currentLoc) => {
            const list = document.getElementById('map-list');
            list.innerHTML = '';
            locations.forEach(loc => {
                if (loc.id === currentLoc) return; // Не показываем текущую
                
                const card = document.createElement('div');
                card.className = 'map-card';
                card.innerHTML = `<h3>${loc.name}</h3><p>${loc.desc}</p>`;
                card.addEventListener('click', () => {
                    this.game.events.emit('teleportTo', loc.id);
                    this.toggleModal('modal-map');
                });
                list.appendChild(card);
            });
        });
    }

    toggleModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            // Закрываем все остальные
            document.querySelectorAll('.modal-overlay').forEach(m => {
                if (m.id !== id) m.classList.remove('active');
            });
            modal.classList.toggle('active');
        }
    }
}