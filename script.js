class CheckersGame {
    constructor() {
        this.socket = null;
        this.playerColor = null;
        this.playerNick = null;
        this.opponentNick = null;
        this.board = [];
        this.selectedPiece = null;
        this.possibleMoves = [];
        this.currentPlayer = 'white';
        this.isGameActive = false;
        
        this.init();
    }

    init() {
        this.setupLogin();
        this.setupGameControls();
        this.connectToServer();
    }

    connectToServer() {
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Connected to server');
        });

        this.socket.on('playerAssigned', (data) => {
            this.playerColor = data.color;
            this.playerNick = this.nickname;
            this.updatePlayersDisplay();
            document.getElementById('gameStatus').textContent = `Вы играете за ${data.color === 'white' ? 'белые' : 'черные'}`;
        });

        this.socket.on('gameState', (data) => {
            this.board = data.board;
            this.currentPlayer = data.currentPlayer;
            
            if (data.players) {
                this.opponentNick = data.players.find(player => 
                    player.nick !== this.playerNick
                )?.nick;
                this.updatePlayersDisplay();
            }
            
            this.updateTurnStatus();
            this.renderBoard();
            this.updateGameControls();
        });

        this.socket.on('opponentJoined', (data) => {
            this.opponentNick = data.opponentNick;
            this.updatePlayersDisplay();
            this.showNotification(`Игрок ${data.opponentNick} присоединился к игре`);
        });

        this.socket.on('moveMade', (data) => {
            this.board = data.board;
            this.currentPlayer = data.currentPlayer;
            this.renderBoard();
            this.updateTurnStatus();
            this.showDirectionArrow(data.from, data.to);
            this.updateGameControls();
        });

        this.socket.on('drawOfferReceived', () => {
            this.showDrawOfferModal('Противник предлагает ничью. Согласны?');
        });

        this.socket.on('drawResponse', (data) => {
            if (data.accepted) {
                this.showGameOverModal('Ничья по соглашению');
            } else {
                this.showNotification('Противник отклонил предложение ничьи');
            }
        });

        this.socket.on('gameOver', (data) => {
            this.isGameActive = false;
            let message = '';
            
            if (data.winner === 'draw') {
                message = 'Ничья!';
            } else if (data.winner === this.playerColor) {
                message = 'Вы победили!';
            } else {
                message = 'Вы проиграли!';
            }
            
            if (data.reason) {
                message += ` (${data.reason})`;
            }
            
            this.showGameOverModal(message);
            this.updateGameControls();
        });

        this.socket.on('error', (data) => {
            this.showNotification(`Ошибка: ${data.message}`);
        });

        this.socket.on('playerLeft', () => {
            this.opponentNick = null;
            this.updatePlayersDisplay();
            this.showNotification('Противник покинул игру');
            this.updateGameControls();
        });
    }

    updatePlayersDisplay() {
        const playersDisplay = document.getElementById('playersDisplay');
        
        if (this.playerColor && this.opponentNick) {
            // Оба игрока подключены
            if (this.playerColor === 'white') {
                playersDisplay.textContent = `${this.playerNick} vs ${this.opponentNick}`;
            } else {
                playersDisplay.textContent = `${this.opponentNick} vs ${this.playerNick}`;
            }
        } else if (this.playerColor) {
            // Только текущий игрок подключен
            playersDisplay.textContent = `${this.playerNick} vs Ожидание игрока...`;
        } else {
            // Игрок еще не подключился
            playersDisplay.textContent = 'Ожидание игроков...';
        }
    }

    setupLogin() {
        const loginModal = document.getElementById('loginModal');
        const nicknameInput = document.getElementById('nicknameInput');
        const loginBtn = document.getElementById('loginBtn');

        // Показываем модальное окно входа
        loginModal.style.display = 'block';

        loginBtn.addEventListener('click', () => {
            const nickname = nicknameInput.value.trim();
            if (nickname.length >= 2 && nickname.length <= 15) {
                this.nickname = nickname;
                this.socket.emit('join', { nick: nickname });
                loginModal.style.display = 'none';
                this.playerNick = nickname;
                this.updatePlayersDisplay();
            } else {
                alert('Ник должен содержать от 2 до 15 символов');
            }
        });

        nicknameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                loginBtn.click();
            }
        });

        // Фокус на поле ввода
        nicknameInput.focus();
    }

    setupGameControls() {
        const newGameBtn = document.getElementById('newGameBtn');
        const drawOfferBtn = document.getElementById('drawOfferBtn');
        const confirmNewGame = document.getElementById('confirmNewGame');
        const cancelNewGame = document.getElementById('cancelNewGame');
        const newGameModal = document.getElementById('newGameModal');
        const acceptDraw = document.getElementById('acceptDraw');
        const declineDraw = document.getElementById('declineDraw');
        const drawOfferModal = document.getElementById('drawOfferModal');
        const newGameAfterOver = document.getElementById('newGameAfterOver');

        newGameBtn.addEventListener('click', () => {
            newGameModal.style.display = 'block';
        });

        confirmNewGame.addEventListener('click', () => {
            this.socket.emit('newGame');
            newGameModal.style.display = 'none';
        });

        cancelNewGame.addEventListener('click', () => {
            newGameModal.style.display = 'none';
        });

        drawOfferBtn.addEventListener('click', () => {
            this.socket.emit('drawOffer');
            this.showNotification('Предложение ничьи отправлено');
        });

        acceptDraw.addEventListener('click', () => {
            this.socket.emit('drawResponse', { accepted: true });
            drawOfferModal.style.display = 'none';
        });

        declineDraw.addEventListener('click', () => {
            this.socket.emit('drawResponse', { accepted: false });
            drawOfferModal.style.display = 'none';
        });

        newGameAfterOver.addEventListener('click', () => {
            this.socket.emit('newGame');
            document.getElementById('gameOverModal').style.display = 'none';
        });
    }

    updateGameControls() {
        const newGameBtn = document.getElementById('newGameBtn');
        const drawOfferBtn = document.getElementById('drawOfferBtn');

        const isMyTurn = this.currentPlayer === this.playerColor;
        const isGameActive = this.isGameActive && this.opponentNick;

        newGameBtn.disabled = !isGameActive;
        drawOfferBtn.disabled = !isGameActive || !isMyTurn;
    }

    updateTurnStatus() {
        const gameStatus = document.getElementById('gameStatus');
        const isMyTurn = this.currentPlayer === this.playerColor;
        
        if (this.playerColor) {
            const colorText = this.playerColor === 'white' ? 'белые' : 'черные';
            const turnText = isMyTurn ? 'Ваш ход' : 'Ход противника';
            gameStatus.textContent = `${this.playerNick} (${colorText}) - ${turnText}`;
        }
        
        this.isGameActive = true;
        this.updateGameControls();
    }

    renderBoard() {
        const boardElement = document.getElementById('gameBoard');
        boardElement.innerHTML = '';

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const cell = document.createElement('div');
                cell.className = `cell ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
                cell.dataset.row = row;
                cell.dataset.col = col;

                const piece = this.board[row][col];
                if (piece) {
                    const pieceElement = document.createElement('div');
                    pieceElement.className = `piece ${piece.color} ${piece.king ? 'king' : ''}`;
                    pieceElement.addEventListener('click', () => this.handlePieceClick(row, col));
                    cell.appendChild(pieceElement);
                }

                cell.addEventListener('click', () => this.handleCellClick(row, col));
                boardElement.appendChild(cell);
            }
        }

        this.highlightPossibleMoves();
    }

    handlePieceClick(row, col) {
        const piece = this.board[row][col];
        
        if (piece.color === this.playerColor && this.currentPlayer === this.playerColor) {
            this.selectedPiece = { row, col };
            this.possibleMoves = this.getPossibleMoves(row, col);
            this.renderBoard();
        }
    }

    handleCellClick(row, col) {
        if (!this.selectedPiece) return;

        const move = this.possibleMoves.find(move => 
            move.toRow === row && move.toCol === col
        );

        if (move) {
            this.socket.emit('move', {
                fromRow: this.selectedPiece.row,
                fromCol: this.selectedPiece.col,
                toRow: row,
                toCol: col
            });
            
            this.selectedPiece = null;
            this.possibleMoves = [];
        }
    }

    getPossibleMoves(row, col) {
        // Эта функция теперь в основном на сервере
        // Здесь можно оставить базовую логику для подсветки
        return [];
    }

    highlightPossibleMoves() {
        if (this.selectedPiece) {
            const cell = document.querySelector(
                `.cell[data-row="${this.selectedPiece.row}"][data-col="${this.selectedPiece.col}"]`
            );
            if (cell) {
                cell.classList.add('selected');
            }
        }
    }

    showDirectionArrow(from, to) {
        const arrow = document.getElementById('directionArrow');
        const fromCell = document.querySelector(
            `.cell[data-row="${from.row}"][data-col="${from.col}"]`
        );
        const toCell = document.querySelector(
            `.cell[data-row="${to.row}"][data-col="${to.col}"]`
        );

        if (fromCell && toCell) {
            const fromRect = fromCell.getBoundingClientRect();
            const toRect = toCell.getBoundingClientRect();
            const boardRect = document.getElementById('gameBoard').getBoundingClientRect();

            const fromX = fromRect.left + fromRect.width / 2 - boardRect.left;
            const fromY = fromRect.top + fromRect.height / 2 - boardRect.top;
            const toX = toRect.left + toRect.width / 2 - boardRect.left;
            const toY = toRect.top + toRect.height / 2 - boardRect.top;

            const angle = Math.atan2(toY - fromY, toX - fromX) * 180 / Math.PI;
            const length = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));

            arrow.style.left = fromX + 'px';
            arrow.style.top = fromY + 'px';
            arrow.style.transform = `rotate(${angle}deg) scaleY(${length / 20})`;
            arrow.classList.add('visible');

            setTimeout(() => {
                arrow.classList.remove('visible');
            }, 1000);
        }
    }

    showDrawOfferModal(message) {
        const modal = document.getElementById('drawOfferModal');
        const text = document.getElementById('drawOfferText');
        text.textContent = message;
        modal.style.display = 'block';
    }

    showGameOverModal(message) {
        const modal = document.getElementById('gameOverModal');
        const title = document.getElementById('gameOverTitle');
        const messageElement = document.getElementById('gameOverMessage');
        
        title.textContent = 'Игра завершена';
        messageElement.textContent = message;
        modal.style.display = 'block';
    }

    showNotification(message) {
        // Простая реализация уведомления
        alert(message);
    }
}

// Инициализация игры при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new CheckersGame();
});
