class CheckersGame {
    constructor() {
        this.socket = null;
        this.playerColor = null;
        this.playerNick = null;
        this.opponentNick = null;
        this.gameBoard = null;
        this.selectedPiece = null;
        this.validMoves = [];
        
        this.init();
    }

    init() {
        this.setupLogin();
        this.initializeBoard();
        this.setupGameControls();
    }

    setupLogin() {
        const loginModal = document.getElementById('loginModal');
        const gameInterface = document.getElementById('gameInterface');
        const nicknameInput = document.getElementById('nicknameInput');
        const joinButton = document.getElementById('joinButton');

        // Показать модальное окно входа
        loginModal.style.display = 'flex';
        gameInterface.style.display = 'none';

        joinButton.addEventListener('click', () => {
            const nickname = nicknameInput.value.trim();
            if (nickname) {
                this.connectToGame(nickname);
                loginModal.style.display = 'none';
                gameInterface.style.display = 'block';
            }
        });

        nicknameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                joinButton.click();
            }
        });
    }

    connectToGame(nickname) {
        this.socket = new WebSocket(`ws://${window.location.host}`);
        this.playerNick = nickname;

        this.socket.onopen = () => {
            console.log('Подключение установлено');
            this.socket.send(JSON.stringify({
                type: 'join',
                nickname: nickname
            }));
        };

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };

        this.socket.onclose = () => {
            console.log('Соединение закрыто');
            this.showReconnectMessage();
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket ошибка:', error);
        };
    }

    handleMessage(data) {
        switch (data.type) {
            case 'playerAssigned':
                this.handlePlayerAssigned(data);
                break;
            case 'opponentInfo':
                this.handleOpponentInfo(data);
                break;
            case 'gameState':
                this.handleGameState(data);
                break;
            case 'moveMade':
                this.handleMoveMade(data);
                break;
            case 'gameStatus':
                this.handleGameStatus(data);
                break;
            case 'drawOfferReceived':
                this.handleDrawOfferReceived();
                break;
            case 'drawResponse':
                this.handleDrawResponse(data);
                break;
            case 'gameOver':
                this.handleGameOver(data);
                break;
        }
    }

    handlePlayerAssigned(data) {
        this.playerColor = data.color;
        this.updateTurnStatus(`Вы играете за ${data.color === 'white' ? 'белых' : 'черных'}. Ожидание хода...`);
        this.updateMatchInfo();
    }

    handleOpponentInfo(data) {
        this.opponentNick = data.opponentNick;
        this.updateMatchInfo();
        
        if (data.opponentNick) {
            console.log(`Соперник: ${data.opponentNick}`);
        } else {
            console.log('Соперник отключился');
        }
    }

    updateMatchInfo() {
        const matchInfoElement = document.getElementById('matchInfo');
        if (this.playerNick && this.opponentNick) {
            // Всегда отображаем белые vs черные в правильном порядке
            if (this.playerColor === 'white') {
                matchInfoElement.textContent = `${this.playerNick} vs ${this.opponentNick}`;
            } else {
                matchInfoElement.textContent = `${this.opponentNick} vs ${this.playerNick}`;
            }
            matchInfoElement.className = 'match-info status-active';
        } else {
            matchInfoElement.textContent = 'Ожидание соперника...';
            matchInfoElement.className = 'match-info status-waiting';
        }
    }

    updateTurnStatus(status) {
        const statusElement = document.getElementById('gameStatus');
        statusElement.textContent = status;
        
        // Динамическое обновление классов для цветового кодирования
        if (status.includes('Ваш ход')) {
            statusElement.className = 'status-text status-active';
        } else if (status.includes('Ожидание') || status.includes('ход соперника')) {
            statusElement.className = 'status-text status-waiting';
        } else if (status.includes('Игра окончена')) {
            statusElement.className = 'status-text status-ended';
        } else {
            statusElement.className = 'status-text';
        }
    }

    initializeBoard() {
        this.gameBoard = Array(8).fill().map(() => Array(8).fill(null));
        this.renderBoard();
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

                const piece = this.gameBoard[row][col];
                if (piece) {
                    const pieceElement = document.createElement('div');
                    pieceElement.className = `piece ${piece.color} ${piece.type === 'king' ? 'king' : ''}`;
                    pieceElement.style.backgroundImage = `url(${this.getPieceImage(piece)})`;
                    
                    pieceElement.addEventListener('click', () => this.handlePieceClick(row, col));
                    cell.appendChild(pieceElement);
                } else {
                    cell.addEventListener('click', () => this.handleCellClick(row, col));
                }

                boardElement.appendChild(cell);
            }
        }
    }

    getPieceImage(piece) {
        const images = {
            'white': 'shabe.png',
            'black': 'shach.png',
            'white_king': 'shabedam.png',
            'black_king': 'shachdam.png'
        };
        
        const key = piece.type === 'king' ? `${piece.color}_king` : piece.color;
        return images[key];
    }

    handlePieceClick(row, col) {
        if (!this.isMyTurn()) return;

        const piece = this.gameBoard[row][col];
        if (piece && piece.color === this.playerColor) {
            this.selectedPiece = { row, col };
            this.clearValidMoves();
            this.showValidMoves(row, col);
        }
    }

    handleCellClick(row, col) {
        if (!this.selectedPiece || !this.isMyTurn()) return;

        const move = {
            from: [this.selectedPiece.row, this.selectedPiece.col],
            to: [row, col]
        };

        // Проверяем, является ли ход валидным
        const isValidMove = this.validMoves.some(validMove => 
            validMove[0] === row && validMove[1] === col
        );

        if (isValidMove) {
            this.socket.send(JSON.stringify({
                type: 'move',
                move: move
            }));
            this.clearValidMoves();
            this.selectedPiece = null;
        }
    }

    isMyTurn() {
        // Эта логика будет обновляться из серверных сообщений
        return true; // Временная заглушка
    }

    showValidMoves(row, col) {
        // Временная реализация - реальная логика будет на сервере
        const directions = [
            [1, 1], [1, -1], [-1, 1], [-1, -1]
        ];

        directions.forEach(([dRow, dCol]) => {
            const newRow = row + dRow;
            const newCol = col + dCol;
            
            if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
                if (!this.gameBoard[newRow][newCol]) {
                    this.validMoves.push([newRow, newCol]);
                    this.highlightCell(newRow, newCol);
                }
            }
        });
    }

    highlightCell(row, col) {
        const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        if (cell) {
            cell.classList.add('valid-move');
        }
    }

    clearValidMoves() {
        document.querySelectorAll('.valid-move').forEach(cell => {
            cell.classList.remove('valid-move');
        });
        this.validMoves = [];
    }

    handleGameState(data) {
        this.gameBoard = data.board;
        this.renderBoard();
        this.updateTurnStatus(this.getTurnStatus(data.currentTurn));
    }

    handleMoveMade(data) {
        this.gameBoard = data.board;
        this.renderBoard();
        
        // Добавляем визуализацию стрелки направления хода
        this.showMoveArrow(data.from, data.to);
        
        this.updateTurnStatus(this.getTurnStatus(data.currentTurn));
        this.updateMatchInfo(); // Обновляем информацию о матче после хода
    }

    showMoveArrow(from, to) {
        // Удаляем предыдущую стрелку
        this.removeMoveArrow();
        
        const [fromRow, fromCol] = from;
        const [toRow, toCol] = to;
        
        const boardElement = document.getElementById('gameBoard');
        const fromCell = document.querySelector(`.cell[data-row="${fromRow}"][data-col="${fromCol}"]`);
        const toCell = document.querySelector(`.cell[data-row="${toRow}"][data-col="${toCol}"]`);
        
        if (!fromCell || !toCell) return;
        
        const fromRect = fromCell.getBoundingClientRect();
        const toRect = toCell.getBoundingClientRect();
        const boardRect = boardElement.getBoundingClientRect();
        
        const fromX = fromRect.left + fromRect.width / 2 - boardRect.left;
        const fromY = fromRect.top + fromRect.height / 2 - boardRect.top;
        const toX = toRect.left + toRect.width / 2 - boardRect.left;
        const toY = toRect.top + toRect.height / 2 - boardRect.top;
        
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        arrow.className = 'move-arrow';
        arrow.style.position = 'absolute';
        arrow.style.left = '0';
        arrow.style.top = '0';
        arrow.style.width = '100%';
        arrow.style.height = '100%';
        arrow.style.pointerEvents = 'none';
        
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', fromX);
        line.setAttribute('y1', fromY);
        line.setAttribute('x2', toX);
        line.setAttribute('y2', toY);
        line.setAttribute('stroke', '#e74c3c');
        line.setAttribute('stroke-width', '3');
        line.setAttribute('marker-end', 'url(#arrowhead)');
        
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '7');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '3.5');
        marker.setAttribute('orient', 'auto');
        
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
        polygon.setAttribute('fill', '#e74c3c');
        
        marker.appendChild(polygon);
        defs.appendChild(marker);
        arrow.appendChild(defs);
        arrow.appendChild(line);
        
        boardElement.appendChild(arrow);
        
        // Автоматическое удаление стрелки через 3 секунды
        setTimeout(() => {
            this.removeMoveArrow();
        }, 3000);
    }

    removeMoveArrow() {
        const existingArrow = document.querySelector('.move-arrow');
        if (existingArrow) {
            existingArrow.remove();
        }
    }

    getTurnStatus(currentTurn) {
        if (currentTurn === this.playerColor) {
            return `${this.playerNick} (${this.playerColor === 'white' ? 'белые' : 'черные'}) - Ваш ход`;
        } else {
            return `${this.playerNick} (${this.playerColor === 'white' ? 'белые' : 'черные'}) - Ход соперника`;
        }
    }

    handleGameStatus(data) {
        this.updateTurnStatus(data.status);
    }

    setupGameControls() {
        const newGameButton = document.getElementById('newGameButton');
        const drawButton = document.getElementById('drawButton');
        const confirmNewGame = document.getElementById('confirmNewGame');
        const cancelNewGame = document.getElementById('cancelNewGame');
        const newGameModal = document.getElementById('newGameModal');
        const drawOfferModal = document.getElementById('drawOfferModal');
        const acceptDraw = document.getElementById('acceptDraw');
        const declineDraw = document.getElementById('declineDraw');
        const newGameAfterOver = document.getElementById('newGameAfterOver');

        newGameButton.addEventListener('click', () => {
            newGameModal.style.display = 'flex';
        });

        cancelNewGame.addEventListener('click', () => {
            newGameModal.style.display = 'none';
        });

        confirmNewGame.addEventListener('click', () => {
            this.socket.send(JSON.stringify({ type: 'newGame' }));
            newGameModal.style.display = 'none';
        });

        drawButton.addEventListener('click', () => {
            this.socket.send(JSON.stringify({ type: 'drawOffer' }));
        });

        acceptDraw.addEventListener('click', () => {
            this.socket.send(JSON.stringify({ 
                type: 'drawResponse', 
                accepted: true 
            }));
            drawOfferModal.style.display = 'none';
        });

        declineDraw.addEventListener('click', () => {
            this.socket.send(JSON.stringify({ 
                type: 'drawResponse', 
                accepted: false 
            }));
            drawOfferModal.style.display = 'none';
        });

        newGameAfterOver.addEventListener('click', () => {
            this.socket.send(JSON.stringify({ type: 'newGame' }));
            document.getElementById('gameOverModal').style.display = 'none';
        });
    }

    handleDrawOfferReceived() {
        const drawOfferModal = document.getElementById('drawOfferModal');
        drawOfferModal.style.display = 'flex';
    }

    handleDrawResponse(data) {
        if (!data.accepted) {
            this.updateTurnStatus('Предложение ничьи отклонено');
        }
    }

    handleGameOver(data) {
        const gameOverModal = document.getElementById('gameOverModal');
        const gameOverMessage = document.getElementById('gameOverMessage');
        
        let message = '';
        if (data.winner) {
            const winnerColor = data.winner === 'white' ? 'белые' : 'черные';
            if (data.winner === this.playerColor) {
                message = `Поздравляем! Вы победили! (${winnerColor})`;
            } else {
                message = `Вы проиграли. Победили ${winnerColor}`;
            }
        } else {
            message = 'Ничья!';
        }
        
        if (data.message) {
            message += `\n${data.message}`;
        }
        
        gameOverMessage.textContent = message;
        gameOverModal.style.display = 'flex';
        
        this.updateTurnStatus('Игра окончена');
    }

    showReconnectMessage() {
        alert('Соединение потеряно. Пожалуйста, обновите страницу для переподключения.');
    }
}

// Инициализация игры при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new CheckersGame();
});
