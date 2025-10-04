// script.js - ФИНАЛЬНАЯ ВЕРСИЯ для шашек с рестартом и стрелкой направления для обоих игроков
class CheckersGame {
    constructor() {
        this.board = document.getElementById('board');
        this.status = document.getElementById('status');
        this.restartContainer = document.getElementById('restartContainer');
        this.restartButton = document.getElementById('restartButton');
        this.currentPlayer = 'white';
        this.selectedPiece = null;
        this.possibleMoves = [];
        this.playerColor = null;
        this.ws = null;
        this.currentArrow = null; // Для хранения текущей стрелки
        
        this.initializeGame();
        this.setupWebSocket();
        this.setupRestartButton();
    }

    initializeGame() {
        this.createBoard();
        this.updateStatus('Подключение к серверу...');
    }

    createBoard() {
        this.board.innerHTML = '';
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const cell = document.createElement('div');
                cell.className = `cell ${(row + col) % 2 === 0 ? 'white' : 'black'}`;
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                // Только черные клетки кликабельны
                if ((row + col) % 2 !== 0) {
                    cell.addEventListener('click', () => this.handleCellClick(row, col));
                }
                
                this.board.appendChild(cell);
            }
        }
    }

    handleCellClick(row, col) {
        console.log('Cell clicked:', row, col);
        
        if (!this.playerColor) {
            this.updateStatus('Ожидание подключения...');
            return;
        }
        
        if (this.playerColor !== this.currentPlayer) {
            this.updateStatus('Сейчас не ваш ход!');
            return;
        }
        
        const cell = this.getCell(row, col);
        const piece = cell.querySelector('.piece');
        
        // Если уже выбрана шашка - пробуем сделать ход
        if (this.selectedPiece) {
            this.makeMove(this.selectedPiece.row, this.selectedPiece.col, row, col);
            this.clearSelection();
        } 
        // Если кликнули на свою шашку - выбираем её
        else if (piece && piece.dataset.color === this.playerColor) {
            this.selectedPiece = { row, col };
            this.highlightCell(row, col, 'selected');
            this.updateStatus('Выберите клетку для хода');
        }
    }

    makeMove(fromRow, fromCol, toRow, toCol) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.updateStatus('Нет соединения с сервером');
            return;
        }

        const moveData = {
            fromRow: fromRow,
            fromCol: fromCol,
            toRow: toRow,
            toCol: toCol
        };

        console.log('Sending move:', moveData);
        this.ws.send(JSON.stringify({
            type: 'move',
            data: moveData
        }));
        
        this.updateStatus('Ход отправляется...');
        
        // Стрелка теперь показывается через серверное сообщение moveMade
    }

    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        console.log('Connecting to WebSocket:', wsUrl);
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('✅ WebSocket connected successfully');
            this.updateStatus('Подключено! Ожидание второго игрока...');
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log('📨 Received message:', message);
                this.handleServerMessage(message);
            } catch (error) {
                console.error('❌ Error parsing message:', error);
            }
        };

        this.ws.onclose = (event) => {
            console.log('🔌 WebSocket disconnected:', event.code, event.reason);
            this.updateStatus('Соединение потеряно. Переподключение через 3 секунды...');
            setTimeout(() => {
                this.setupWebSocket();
            }, 3000);
        };

        this.ws.onerror = (error) => {
            console.error('💥 WebSocket error:', error);
            this.updateStatus('Ошибка соединения с сервером');
        };
    }

    setupRestartButton() {
        this.restartButton.addEventListener('click', () => {
            this.restartGame();
        });
    }

    restartGame() {
        console.log('Restarting game...');
        
        // Удаляем стрелку
        this.removeMoveArrow();
        
        // Скрываем блок рестарта
        this.restartContainer.style.display = 'none';
        
        // Показываем доску и статус
        this.board.style.display = 'grid';
        this.status.style.display = 'block';
        
        // Сбрасываем состояние игры
        this.selectedPiece = null;
        this.possibleMoves = [];
        this.playerColor = null;
        this.currentPlayer = 'white';
        
        // Обновляем статус
        this.updateStatus('Перезапуск игры...');
        
        // Очищаем доску
        this.clearBoard();
        
        // Переподключаемся к серверу
        if (this.ws) {
            this.ws.close();
        }
        
        // Перезагружаем игру через небольшой таймаут
        setTimeout(() => {
            this.setupWebSocket();
        }, 1000);
    }

    clearBoard() {
        // Очищаем все шашки с доски
        document.querySelectorAll('.piece').forEach(piece => piece.remove());
    }

    createMoveArrow(fromRow, fromCol, toRow, toCol) {
        // Удаляем предыдущую стрелку, если есть
        // Автоматически удаляем стрелку через 5 секунды
        setTimeout(() => {
            this.removeMoveArrow();
        }, 5000); // ← ЭТА СТРОКА (3000 мс = 5 секунды)
        
        const fromCell = this.getCell(fromRow, fromCol);
        const toCell = this.getCell(toRow, toCol);
        
        if (!fromCell || !toCell) return;
        
        // Получаем координаты центров клеток
        const fromRect = fromCell.getBoundingClientRect();
        const toRect = toCell.getBoundingClientRect();
        const boardRect = this.board.getBoundingClientRect();
        
        // Вычисляем координаты относительно доски
        const fromX = fromRect.left + fromRect.width / 2 - boardRect.left;
        const fromY = fromRect.top + fromRect.height / 2 - boardRect.top;
        const toX = toRect.left + toRect.width / 2 - boardRect.left;
        const toY = toRect.top + toRect.height / 2 - boardRect.top;
        
        // Создаем SVG элемент для стрелки
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.classList.add('move-arrow');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.pointerEvents = 'none';
        
        // Вычисляем длину и угол стрелки
        const dx = toX - fromX;
        const dy = toY - fromY;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        
        // Укорачиваем стрелку, чтобы она не заходила на шашки
        const shortenBy = 25;
        const shortenedLength = length - shortenBy * 2;
        const shortenX = (dx / length) * shortenBy;
        const shortenY = (dy / length) * shortenBy;
        
        const adjustedFromX = fromX + shortenX;
        const adjustedFromY = fromY + shortenY;
        const adjustedToX = toX - shortenX;
        const adjustedToY = toY - shortenY;
        
        // Создаем линию стрелки
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.classList.add('arrow-line', 'arrow-animation');
        line.setAttribute('x1', adjustedFromX);
        line.setAttribute('y1', adjustedFromY);
        line.setAttribute('x2', adjustedToX);
        line.setAttribute('y2', adjustedToY);
        
        // Создаем наконечник стрелки
        const headLength = 15;
        const headAngle = 30;
        
        const head = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        head.classList.add('arrow-head');
        
        const angleRad = angle * Math.PI / 180;
        const x1 = adjustedToX - headLength * Math.cos(angleRad - headAngle * Math.PI / 180);
        const y1 = adjustedToY - headLength * Math.sin(angleRad - headAngle * Math.PI / 180);
        const x2 = adjustedToX - headLength * Math.cos(angleRad + headAngle * Math.PI / 180);
        const y2 = adjustedToY - headLength * Math.sin(angleRad + headAngle * Math.PI / 180);
        
        head.setAttribute('points', `${adjustedToX},${adjustedToY} ${x1},${y1} ${x2},${y2}`);
        
        svg.appendChild(line);
        svg.appendChild(head);
        
        // Сохраняем ссылку на стрелку
        this.currentArrow = svg;
        
        // Добавляем стрелку на доску
        this.board.appendChild(svg);
        
        // Автоматически удаляем стрелку через 3 секунды
        setTimeout(() => {
            this.removeMoveArrow();
        }, 3000);
    }

    removeMoveArrow() {
        if (this.currentArrow) {
            this.currentArrow.remove();
            this.currentArrow = null;
        }
    }

    handleServerMessage(message) {
        switch (message.type) {
            case 'playerAssigned':
                this.playerColor = message.color;
                const colorText = message.color === 'white' ? 'белые' : 'черные';
                this.updateStatus(`Вы играете за ${colorText}. Ожидание второго игрока...`);
                break;
                
            case 'gameState':
                this.updateGameState(message.data);
                break;
                
            case 'moveResult':
                if (message.valid) {
                    this.updateGameState(message.gameState);
                    const statusText = message.gameState.currentPlayer === this.playerColor ? 
                        '✅ Ваш ход!' : '⏳ Ход противника...';
                    this.updateStatus(statusText);
                } else {
                    this.updateStatus(`❌ ${message.message}`);
                }
                break;
                
            case 'moveMade': // НОВЫЙ CASE - обработка хода от любого игрока
                this.handleMoveMade(message.data);
                break;
                
            case 'gameOver':
                this.handleGameOver(message);
                break;
                
            case 'error':
                this.updateStatus(`⚠️ ${message.message}`);
                break;
                
            default:
                console.log('Unknown message type:', message.type);
        }
    }

    handleMoveMade(moveData) {
        console.log('Move made by:', moveData.player, moveData);
        
        // Показываем стрелку для ЛЮБОГО хода, независимо от того, кто его сделал
        this.createMoveArrow(
            moveData.fromRow, 
            moveData.fromCol, 
            moveData.toRow, 
            moveData.toCol
        );
        
        // Обновляем статус, если ход сделал противник
        if (moveData.player !== this.playerColor) {
            this.updateStatus('⏳ Ход противника...');
        }
    }

    updateGameState(gameState) {
        // Очищаем доску
        this.clearBoard();
        
        // Расставляем шашки согласно состоянию игры
        gameState.pieces.forEach(piece => {
            this.placePiece(piece.row, piece.col, piece.color, piece.isKing);
        });
        
        // Обновляем текущего игрока
        this.currentPlayer = gameState.currentPlayer;
        
        console.log('Game state updated. Current player:', this.currentPlayer);
    }

    placePiece(row, col, color, isKing = false) {
        const cell = this.getCell(row, col);
        if (!cell) return;
        
        const piece = document.createElement('div');
        piece.className = `piece ${color} ${isKing ? 'king' : ''}`;
        piece.dataset.color = color;
        piece.dataset.king = isKing;
        
        // Создаем изображение шашки
        const img = document.createElement('img');
        let imageSrc;
        
        if (color === 'white') {
            imageSrc = isKing ? 'shabedam.png' : 'shabe.png';
        } else {
            imageSrc = isKing ? 'shachdam.png' : 'shach.png';
        }
        
        img.src = imageSrc;
        img.alt = isKing ? `${color} дамка` : `${color} шашка`;
        img.onerror = () => {
            console.error(`Failed to load image: ${imageSrc}`);
            // Запасной вариант - цветной круг
            piece.style.backgroundColor = color;
            piece.style.border = '2px solid #000';
            if (isKing) {
                piece.innerHTML = '♔';
                piece.style.color = 'gold';
            }
        };
        
        piece.appendChild(img);
        cell.appendChild(piece);
    }

    getCell(row, col) {
        return document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    }

    highlightCell(row, col, className) {
        const cell = this.getCell(row, col);
        if (cell) {
            // Сначала убираем все выделения
            document.querySelectorAll('.cell').forEach(c => {
                c.classList.remove('selected', 'possible-move');
            });
            // Затем добавляем новое
            cell.classList.add(className);
        }
    }

    clearSelection() {
        this.selectedPiece = null;
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('selected', 'possible-move');
        });
    }

    handleGameOver(result) {
        const winnerText = result.winner ? 
            `🏆 Победитель: ${result.winner === 'white' ? 'белые' : 'черные'}` : 
            '🤝 Ничья!';
        this.updateStatus(`Игра окончена! ${winnerText}`);
        
        // Удаляем стрелку при окончании игры
        this.removeMoveArrow();
        
        // Показываем блок рестарта
        this.showRestartContainer();
    }

    showRestartContainer() {
        // Скрываем доску и статус
        this.board.style.display = 'none';
        this.status.style.display = 'none';
        
        // Показываем блок рестарта
        this.restartContainer.style.display = 'block';
    }

    updateStatus(message) {
        if (this.status) {
            this.status.textContent = message;
        }
        console.log('Status:', message);
    }
}

// Запускаем игру когда страница полностью загружена
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Starting Checkers Game...');
    new CheckersGame();
});

// Добавляем обработчик для переподключения при видимости страницы
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        // Страница снова стала активной - проверяем соединение
        console.log('Page became visible, checking connection...');
    }
});


