class CheckersGame {
    constructor() {
        this.socket = null;
        this.playerColor = null;
        this.playerNickname = null;
        this.gameBoard = [];
        this.selectedPiece = null;
        this.validMoves = [];
        this.isMyTurn = false;
        this.players = { white: null, black: null };
        this.initializeGame();
    }

    initializeGame() {
        this.setupLogin();
        this.createBoard();
        this.setupWebSocket();
        this.setupGameControls();
    }

    setupLogin() {
        const loginModal = document.getElementById('loginModal');
        const nicknameInput = document.getElementById('nicknameInput');
        const joinButton = document.getElementById('joinButton');

        // Показываем модальное окно входа
        loginModal.style.display = 'flex';
        nicknameInput.focus();

        joinButton.addEventListener('click', () => {
            const nickname = nicknameInput.value.trim();
            if (nickname) {
                this.playerNickname = nickname;
                loginModal.style.display = 'none';
                this.joinGame(nickname);
            }
        });

        nicknameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                joinButton.click();
            }
        });
    }

    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
            console.log('Connected to server');
        };

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };

        this.socket.onclose = () => {
            console.log('Disconnected from server');
            setTimeout(() => {
                this.setupWebSocket();
            }, 3000);
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    handleMessage(data) {
        switch (data.type) {
            case 'playerAssigned':
                this.playerColor = data.color;
                this.updateTurnStatus();
                break;

            case 'gameState':
                this.gameBoard = data.board;
                this.players = data.players;
                this.isMyTurn = data.currentPlayer === this.playerColor;
                this.updatePlayersDisplay();
                this.updateTurnStatus();
                this.renderBoard();
                break;

            case 'moveMade':
                this.gameBoard = data.board;
                this.isMyTurn = data.currentPlayer === this.playerColor;
                this.updateTurnStatus();
                this.renderBoard();
                this.showDirectionArrow(data.from, data.to);
                break;

            case 'drawOfferReceived':
                this.showDrawOffer(data.from);
                break;

            case 'drawResponse':
                this.showDrawResponse(data.accepted);
                break;

            case 'gameOver':
                this.showGameOver(data.winner, data.reason);
                break;

            case 'error':
                console.error('Server error:', data.message);
                break;
        }
    }

    joinGame(nickname) {
        if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'join',
                nickname: nickname
            }));
        }
    }

    createBoard() {
        const board = document.getElementById('gameBoard');
        board.innerHTML = '';

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const cell = document.createElement('div');
                cell.className = `cell ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
                cell.dataset.row = row;
                cell.dataset.col = col;

                if ((row + col) % 2 !== 0) {
                    cell.addEventListener('click', () => this.handleCellClick(row, col));
                }

                board.appendChild(cell);
            }
        }
    }

    renderBoard() {
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
            cell.innerHTML = '';
            cell.classList.remove('valid-move');
        });

        // Удаляем старые стрелки
        document.querySelectorAll('.direction-arrow').forEach(arrow => arrow.remove());

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.gameBoard[row][col];
                if (piece) {
                    const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
                    const pieceElement = document.createElement('div');
                    pieceElement.className = `piece ${piece.color} ${piece.king ? 'king' : ''}`;
                    pieceElement.addEventListener('click', () => this.handlePieceClick(row, col));
                    cell.appendChild(pieceElement);
                }
            }
        }

        // Показываем валидные ходы для выбранной шашки
        this.validMoves.forEach(move => {
            const cell = document.querySelector(`.cell[data-row="${move.row}"][data-col="${move.col}"]`);
            cell.classList.add('valid-move');
        });
    }

    handlePieceClick(row, col) {
        const piece = this.gameBoard[row][col];
        
        if (!this.isMyTurn || piece.color !== this.playerColor) {
            return;
        }

        this.selectedPiece = { row, col };
        this.requestValidMoves(row, col);
    }

    handleCellClick(row, col) {
        if (!this.isMyTurn || !this.selectedPiece) {
            return;
        }

        const isValidMove = this.validMoves.some(move => 
            move.row === row && move.col === col
        );

        if (isValidMove) {
            this.makeMove(this.selectedPiece.row, this.selectedPiece.col, row, col);
            this.selectedPiece = null;
            this.validMoves = [];
        }
    }

    requestValidMoves(row, col) {
        if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'getValidMoves',
                row: row,
                col: col
            }));
        }
    }

    makeMove(fromRow, fromCol, toRow, toCol) {
        if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'move',
                from: { row: fromRow, col: fromCol },
                to: { row: toRow, col: toCol }
            }));
        }
    }

    showDirectionArrow(from, to) {
        const fromCell = document.querySelector(`.cell[data-row="${from.row}"][data-col="${from.col}"]`);
        const toCell = document.querySelector(`.cell[data-row="${to.row}"][data-col="${to.col}"]`);
        
        if (!fromCell || !toCell) return;

        const fromRect = fromCell.getBoundingClientRect();
        const toRect = toCell.getBoundingClientRect();
        const boardRect = document.getElementById('gameBoard').getBoundingClientRect();

        const fromX = fromRect.left + fromRect.width / 2 - boardRect.left;
        const fromY = fromRect.top + fromRect.height / 2 - boardRect.top;
        const toX = toRect.left + toRect.width / 2 - boardRect.left;
        const toY = toRect.top + toRect.height / 2 - boardRect.top;

        const arrow = document.createElement('div');
        arrow.className = 'direction-arrow';

        // Вычисляем угол поворота
        const angle = Math.atan2(toY - fromY, toX - fromX) * 180 / Math.PI;
        const length = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));

        arrow.style.left = `${fromX}px`;
        arrow.style.top = `${fromY}px`;
        arrow.style.width = `${length}px`;
        arrow.style.height = '2px';
        arrow.style.background = 'red';
        arrow.style.transform = `rotate(${angle}deg)`;
        arrow.style.transformOrigin = '0 0';

        document.getElementById('gameBoard').appendChild(arrow);

        // Удаляем стрелку через 3 секунды
        setTimeout(() => {
            if (arrow.parentNode) {
                arrow.parentNode.removeChild(arrow);
            }
        }, 3000);
    }

    // НОВЫЙ МЕТОД: Обновление отображения ников игроков
    updatePlayersDisplay() {
        const display = document.getElementById('playersDisplay');
        
        if (!this.players.white && !this.players.black) {
            display.textContent = 'Ожидание игроков...';
        } else if (!this.players.white || !this.players.black) {
            // Один игрок подключен, показываем его ник и ожидание
            const connectedPlayer = this.players.white || this.players.black;
            display.textContent = `${connectedPlayer} vs Ожидание игрока...`;
        } else {
            // Оба игрока подключены
            display.textContent = `${this.players.white} vs ${this.players.black}`;
        }
    }

    updateTurnStatus() {
        const status = document.getElementById('gameStatus');
        
        if (!this.playerColor) {
            status.textContent = 'Подключение...';
            return;
        }

        const colorText = this.playerColor === 'white' ? 'Белые' : 'Чёрные';
        const turnText = this.isMyTurn ? 'Ваш ход' : 'Ход противника';
        
        status.textContent = `${this.playerNickname} (${colorText}) - ${turnText}`;
    }

    setupGameControls() {
        const newGameButton = document.getElementById('newGameButton');
        const drawButton = document.getElementById('drawButton');
        const restartButton = document.getElementById('restartButton');

        newGameButton.addEventListener('click', () => {
            if (confirm('Начать новую игру? Текущая игра будет завершена.')) {
                this.socket.send(JSON.stringify({ type: 'newGame' }));
            }
        });

        drawButton.addEventListener('click', () => {
            if (confirm('Предложить ничью?')) {
                this.socket.send(JSON.stringify({ type: 'drawOffer' }));
            }
        });

        restartButton.addEventListener('click', () => {
            this.socket.send(JSON.stringify({ type: 'newGame' }));
        });
    }

    showDrawOffer(fromPlayer) {
        const modal = document.getElementById('drawOfferModal');
        const text = document.getElementById('drawOfferText');
        const acceptButton = document.getElementById('acceptDrawButton');
        const declineButton = document.getElementById('declineDrawButton');

        text.textContent = `Игрок ${fromPlayer} предлагает ничью`;
        modal.style.display = 'flex';

        const handleResponse = (accepted) => {
            this.socket.send(JSON.stringify({
                type: 'drawResponse',
                accepted: accepted
            }));
            modal.style.display = 'none';
            acceptButton.removeEventListener('click', acceptHandler);
            declineButton.removeEventListener('click', declineHandler);
        };

        const acceptHandler = () => handleResponse(true);
        const declineHandler = () => handleResponse(false);

        acceptButton.addEventListener('click', acceptHandler);
        declineButton.addEventListener('click', declineHandler);
    }

    showDrawResponse(accepted) {
        if (accepted) {
            alert('Противник принял предложение ничьи!');
        } else {
            alert('Противник отклонил предложение ничьи.');
        }
    }

    showGameOver(winner, reason) {
        const overlay = document.getElementById('gameOverlay');
        const title = document.getElementById('overlayTitle');
        const message = document.getElementById('overlayMessage');

        overlay.style.display = 'flex';

        if (winner === 'draw') {
            title.textContent = 'Ничья!';
            message.textContent = 'Игра завершилась вничью';
        } else {
            const isWinner = winner === this.playerColor;
            title.textContent = isWinner ? 'Победа!' : 'Поражение';
            
            if (reason === 'resign') {
                message.textContent = isWinner ? 'Противник сдался' : 'Вы сдались';
            } else if (reason === 'timeout') {
                message.textContent = isWinner ? 'У противника закончилось время' : 'У вас закончилось время';
            } else {
                message.textContent = isWinner ? 
                    'Вы выиграли партию!' : 
                    'Противник выиграл партию';
            }
        }
    }
}

// Инициализация игры при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new CheckersGame();
});
