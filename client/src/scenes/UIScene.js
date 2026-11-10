// client/src/scenes/UIScene.js
export default class UIScene extends Phaser.Scene {
    constructor() {
        super({ key: 'UIScene', active: false });
    }

    create() {
        this.injectHTML();
        this.bindEvents();
    }

    injectHTML() {
        let uiContainer = document.getElementById('game-ui');
        if (!uiContainer) {
            uiContainer = document.createElement('div');
            uiContainer.id = 'game-ui';
            document.body.appendChild(uiContainer);
        }

        uiContainer.innerHTML = `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;800;900&display=swap');
                
                #game-ui {
                    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                    pointer-events: none; font-family: 'Nunito', sans-serif; z-index: 1000;
                }
                .ui-top {
                    position: absolute; top: 15px; left: 15px; right: 15px;
                    display: flex; justify-content: space-between; pointer-events: auto;
                }
                .location-badge {
                    background: rgba(15, 23, 42, 0.8); color: white; padding: 10px 25px;
                    border-radius: 30px; font-weight: 900; font-size: 20px; backdrop-filter: blur(10px);
                    border: 2px solid rgba(255,255,255,0.2); box-shadow: 0 8px 25px rgba(0,0,0,0.4);
                    display: flex; align-items: center; gap: 10px; text-shadow: 1px 1px 2px #000;
                }
                .location-badge::before { content: '📍'; font-size: 24px; }
                
                .currency-panel {
                    background: linear-gradient(135deg, #FFD700, #FF8C00);
                    padding: 10px 25px; border-radius: 30px; color: #fff; font-weight: 900;
                    font-size: 20px; box-shadow: 0 8px 25px rgba(255, 140, 0, 0.5);
                    display: flex; align-items: center; gap: 10px; text-shadow: 1px 1px 3px rgba(0,0,0,0.4);
                    transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    border: 2px solid #FFE4B5;
                }
                .currency-panel.bump { transform: scale(1.15); }
                
                .ui-menu {
                    position: absolute; bottom: 20px; left: 20px; display: flex; flex-direction: column; gap: 12px;
                    pointer-events: auto;
                }
                .menu-btn {
                    width: 65px; height: 65px; border-radius: 20px; border: 3px solid #fff;
                    background: rgba(255, 255, 255, 0.95); box-shadow: 0 8px 20px rgba(0,0,0,0.3);
                    font-size: 32px; cursor: pointer; transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    display: flex; justify-content: center; align-items: center;
                }
                .menu-btn:hover { transform: translateY(-5px) scale(1.05); background: #fff; box-shadow: 0 15px 30px rgba(0,0,0,0.4); }
                .menu-btn:active { transform: scale(0.95); }
                
                .ui-chat {
                    position: absolute; bottom: 20px; left: 105px; width: 400px;
                    display: flex; flex-direction: column; gap: 10px; pointer-events: auto;
                }
                .chat-messages {
                    height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;
                    mask-image: linear-gradient(to bottom, transparent, black 20%);
                    -webkit-mask-image: linear-gradient(to bottom, transparent, black 20%);
                    scrollbar-width: none; padding-top: 30px;
                }
                .chat-messages::-webkit-scrollbar { display: none; }
                .chat-msg {
                    background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(5px);
                    color: white; padding: 8px 15px; border-radius: 15px; font-size: 15px;
                    width: fit-content; max-width: 95%; animation: slideInMsg 0.3s ease-out forwards;
                    border: 1px solid rgba(255,255,255,0.2);
                }
                @keyframes slideInMsg { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                .chat-input-wrapper {
                    display: flex; background: rgba(255, 255, 255, 0.95); border-radius: 25px;
                    box-shadow: 0 8px 25px rgba(0,0,0,0.3); overflow: hidden;
                    border: 3px solid transparent; transition: border 0.3s;
                }
                .chat-input-wrapper:focus-within { border-color: #4CAF50; }
                .chat-input {
                    flex: 1; border: none; padding: 12px 20px; font-family: inherit; font-size: 16px; outline: none;
                }
                .chat-send {
                    background: #4CAF50; color: white; border: none; padding: 0 25px;
                    font-weight: 900; font-size: 20px; cursor: pointer; transition: background 0.2s;
                }
                .chat-send:hover { background: #388E3C; }

                .modal-overlay {
                    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(8px);
                    display: none; justify-content: center; align-items: center; pointer-events: auto;
                }
                .modal-overlay.active { display: flex; animation: fadeIn 0.3s; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .modal-content {
                    background: #fff; width: 600px; border-radius: 30px; overflow: hidden;
                    box-shadow: 0 25px 70px rgba(0,0,0,0.6); animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    border: 4px solid #fff;
                }
                @keyframes popIn { from { transform: scale(0.8); } to { transform: scale(1); } }
                .modal-header {
                    padding: 20px 30px; color: white; font-size: 26px; font-weight: 900;
                    display: flex; justify-content: space-between; align-items: center; text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
                }
                .modal-close {
                    background: rgba(255,255,255,0.3); border: none; color: white; width: 40px; height: 40px;
                    border-radius: 50%; font-size: 24px; cursor: pointer; transition: all 0.2s;
                }
                .modal-close:hover { background: rgba(255,255,255,0.5); transform: rotate(90deg); }
                .modal-body { padding: 30px; background: #f8f9fa; max-height: 400px; overflow-y: auto; }
                
                .map-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .map-card {
                    background: white; border-radius: 20px; padding: 25px; text-align: center;
                    cursor: pointer; box-shadow: 0 5px 15px rgba(0,0,0,0.05); border: 3px solid transparent;
                    transition: all 0.3s;
                }
                .map-card:hover { transform: translateY(-5px); border-color: #4CAF50; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
                
                .inv-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
                .inv-slot {
                    background: #e9ecef; border-radius: 20px; aspect-ratio: 1; display: flex;
                    justify-content: center; align-items: center; font-size: 40px;
                    box-shadow: inset 0 3px 8px rgba(0,0,0,0.1); border: 2px solid #dee2e6;
                }
            </style>

            <div class="ui-top">
                <div class="location-badge" id="current-location">Загрузка...</div>
                <div class="currency-panel" id="currency-panel">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" fill="#FFF" stroke="#B8860B" stroke-width="2"/>
                        <circle cx="12" cy="12" r="8" fill="#FFD700"/>
                        <path d="M12 7V17M9 9H15M9 15H15" stroke="#DAA520" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <span id="currency-amount">0</span>
                </div>
            </div>

            <div class="ui-menu">
                <button class="menu-btn" id="btn-map" title="Карта">🗺️</button>
                <button class="menu-btn" id="btn-inv" title="Инвентарь">🎒</button>
                <button class="menu-btn" id="btn-friends" title="Друзья">👥</button>
                <button class="menu-btn" id="btn-profile" title="Профиль">⚙️</button>
            </div>

            <div class="ui-chat">
                <div class="chat-messages" id="chat-messages"></div>
                <div class="chat-input-wrapper">
                    <input type="text" class="chat-input" id="chat-input" placeholder="Написать сообщение..." maxlength="80">
                    <button class="chat-send" id="chat-send">➤</button>
                </div>
            </div>

            <div class="modal-overlay" id="modal-map">
                <div class="modal-content">
                    <div class="modal-header" style="background: linear-gradient(135deg, #FF9A9E, #FECFEF);">
                        <span>🗺️ Карта мира</span>
                        <button class="modal-close" data-close="modal-map">×</button>
                    </div>
                    <div class="modal-body"><div class="map-grid" id="map-list"></div></div>
                </div>
            </div>

            <div class="modal-overlay" id="modal-inv">
                <div class="modal-content">
                    <div class="modal-header" style="background: linear-gradient(135deg, #2196F3, #1976D2);">
                        <span>🎒 Инвентарь</span>
                        <button class="modal-close" data-close="modal-inv">×</button>
                    </div>
                    <div class="modal-body"><div class="inv-grid" id="inventory-grid"></div></div>
                </div>
            </div>

            <div class="modal-overlay" id="modal-profile">
                <div class="modal-content">
                    <div class="modal-header" style="background: linear-gradient(135deg, #4CAF50, #388E3C);">
                        <span>⚙️ Профиль</span>
                        <button class="modal-close" data-close="modal-profile">×</button>
                    </div>
                    <div class="modal-body" style="text-align: center;">
                        <div style="width: 120px; height: 120px; background: #FFD700; border-radius: 50%; margin: 0 auto 20px; display: flex; justify-content: center; align-items: center; font-size: 60px; box-shadow: 0 10px 20px rgba(0,0,0,0.1);">🐱</div>
                        <h2 id="profile-name" style="font-size: 28px; margin-bottom: 5px;">Загрузка...</h2>
                        <p style="color: #666; font-size: 18px; margin-bottom: 30px;">Уровень 1 • Исследователь</p>
                        <button id="btn-logout" style="width: 100%; padding: 15px; background: #F44336; color: white; border: none; border-radius: 15px; font-size: 18px; font-weight: 900; cursor: pointer; transition: background 0.2s;">Выйти из аккаунта</button>
                    </div>
                </div>
            </div>

            <div class="modal-overlay" id="modal-friends">
                <div class="modal-content">
                    <div class="modal-header" style="background: linear-gradient(135deg, #9C27B0, #7B1FA2);">
                        <span>👥 Друзья</span>
                        <button class="modal-close" data-close="modal-friends">×</button>
                    </div>
                    <div class="modal-body" style="text-align: center; padding: 50px; color: #666;">
                        <div style="font-size: 60px; margin-bottom: 20px;">👻</div>
                        <h3>Пока пусто</h3>
                        <p>Добавляйте друзей по никнейму, чтобы играть вместе!</p>
                    </div>
                </div>
            </div>
        `;
    }

    bindEvents() {
        const username = sessionStorage.getItem('katiki_username') || 'Гость';
        document.getElementById('profile-name').innerText = username;

        document.getElementById('btn-map').onclick = () => this.toggleModal('modal-map');
        document.getElementById('btn-inv').onclick = () => this.toggleModal('modal-inv');
        document.getElementById('btn-friends').onclick = () => this.toggleModal('modal-friends');
        document.getElementById('btn-profile').onclick = () => this.toggleModal('modal-profile');
        
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.onclick = (e) => {
                const modalId = e.target.getAttribute('data-close');
                document.getElementById(modalId).classList.remove('active');
            };
        });

        document.getElementById('btn-logout').onclick = () => {
            localStorage.removeItem('katiki_username');
            sessionStorage.clear();
            window.location.reload();
        };

        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send');
        const sendMsg = () => {
            const text = input.value.trim();
            if (text) {
                this.game.events.emit('sendChatMessage', text);
                input.value = '';
            }
        };
        sendBtn.onclick = sendMsg;
        input.onkeypress = (e) => { if (e.key === 'Enter') sendMsg(); };

        this.game.events.on('updateCurrency', (val) => {
            const panel = document.getElementById('currency-panel');
            document.getElementById('currency-amount').innerText = val;
            panel.classList.add('bump');
            setTimeout(() => panel.classList.remove('bump'), 300);
        });

        this.game.events.on('updateInventory', (items) => {
            const grid = document.getElementById('inventory-grid');
            grid.innerHTML = '';
            items.forEach(item => {
                grid.innerHTML += `<div class="inv-slot">${item}</div>`;
            });
            for (let i = items.length; i < 8; i++) {
                grid.innerHTML += `<div class="inv-slot" style="opacity: 0.4; font-size: 24px;">+</div>`;
            }
        });

        this.game.events.on('newChatMessage', (data) => {
            const container = document.getElementById('chat-messages');
            const msg = document.createElement('div');
            msg.className = 'chat-msg';
            msg.innerHTML = `<b style="color: ${data.color}">${data.name}:</b> ${data.text}`;
            container.appendChild(msg);
            container.scrollTop = container.scrollHeight;
            if (container.children.length > 50) container.removeChild(container.firstChild);
        });

        this.game.events.on('updateLocationName', (name) => {
            document.getElementById('current-location').innerText = name;
        });

        this.game.events.on('initMap', (locations, currentLoc) => {
            const list = document.getElementById('map-list');
            list.innerHTML = '';
            locations.forEach(loc => {
                if (loc.id === currentLoc) return;
                const card = document.createElement('div');
                card.className = 'map-card';
                card.innerHTML = `<h3 style="margin: 0 0 10px 0; color: #333;">${loc.name}</h3><p style="margin: 0; color: #666; font-size: 14px;">${loc.desc}</p>`;
                card.onclick = () => {
                    this.game.events.emit('teleportTo', loc.id);
                    this.toggleModal('modal-map');
                };
                list.appendChild(card);
            });
        });
    }

    toggleModal(id) {
        document.querySelectorAll('.modal-overlay').forEach(m => {
            if (m.id !== id) m.classList.remove('active');
        });
        document.getElementById(id).classList.toggle('active');
    }
}