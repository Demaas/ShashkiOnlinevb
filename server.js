const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Обслуживание статических файлов
app.use(express.static('.'));

// Маршрут для главной страницы
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Маршрут для проверки работы сервера
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Checkers server is running' });
});

class CheckersGameServer {
    constructor() {
        this.players = [];
        this.currentPlayer = 'white';
        this.pieces = this.initializePieces();
        this.gameState = 'waiting';
        this.winner = null;
        this.drawOffer = null;
        this.pendingRestart = null;
        this.continueCapture = null;
    }

    initializePieces() {
        const pieces = [];
        
        // Черные шашки (верхняя часть)
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 8; col++) {
                if ((row + col) % 2 !== 0) {
                    pieces.push({ row, col, color: 'black', isKing: false });
                }
            }
        }
        
        // Белые шашки (нижняя часть)
        for (let row = 5; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if ((row + col) % 2 !== 0) {
                    pieces.push({ row, col, color: 'white', isKing: false });
                }
            }
        }
        
        return pieces;
    }

    addPlayer(ws, username) {
        if (this.players.length < 2) {
            const color = this.players.length === 0 ? 'white' : 'black';
            const player = { ws, color, username };
            this.players.push(player);
            
            ws.send(JSON.stringify({
                type: 'playerAssigned',
                color: color
            }));

            console.log(`Player ${username} joined as ${color}. Total players: ${this.players.length}`);
            
            // Отправляем информацию об игроках
            this.broadcastPlayersInfo();
            
            if (this.players.length === 2) {
                this.startGame();
            }
            
            return color;
        }
        return null;
    }

    startGame() {
        this.gameState = 'playing';
        this.currentPlayer = 'white';
        this.drawOffer = null;
        this.pendingRestart = null;
        this.continueCapture = null;
        console.log('Game started! White moves first.');
        this.broadcastGameState();
    }

    removePlayer(ws) {
        const playerIndex = this.players.findIndex(player => player.ws === ws);
        if (playerIndex !== -1) {
            const playerColor = this.players[playerIndex].color;
            const playerName = this.players[playerIndex].username;
            this.players.splice(playerIndex, 1);
            console.log(`Player ${playerName} (${playerColor}) disconnected. Remaining players: ${this.players.length}`);
            
            if (this.gameState === 'playing') {
                this.gameState = 'finished';
                this.winner = this.players[0] ? this.players[0].color : null;
                this.broadcastGameOver();
            }
        }
    }

    // ДОБАВЛЕНА ФУНКЦИЯ ДЛЯ УСТАНОВКИ НИКНЕЙМА
    setPlayerNickname(ws, nickname) {
        const player = this.players.find(p => p.ws === ws);
        if (player) {
            player.nickname = nickname;
            console.log(`Player ${player.color} set nickname: ${nickname}`);
            
            // Уведомляем другого игрока о никнейме оппонента
            this.players.forEach(p => {
                if (p.ws !== ws) {
                    p.ws.send(JSON.stringify({
                        type: 'opponentNickname',
                        nickname: nickname
                    }));
                }
            });
        }
    }

    handleNewGame(ws) {
        const player = this.players.find(p => p.ws === ws);
        if (!player) return;

        console.log(`New game requested by ${player.username} (${player.color})`);

        // Если игрок только один, просто перезапускаем игру
        if (this.players.length === 1) {
            this.resetGame();
            return;
        }

        // Отправляем предложение второму игроку
        this.players.forEach(p => {
            if (p.ws !== ws) {
                p.ws.send(JSON.stringify({
                    type: 'gameRestartRequest',
                    requestedBy: player.username,
                    requestedByColor: player.color
                }));
            }
        });

        // Сохраняем информацию о запросе перезапуска
        this.pendingRestart = {
            requestedBy: player.color,
            requestedByUsername: player.username,
            confirmed: new Set([player.color])
        };

        console.log(`Restart request sent to other player. Waiting for confirmation...`);
    }

    handleRestartConfirm(ws) {
        const player = this.players.find(p => p.ws === ws);
        if (!player || !this.pendingRestart) return;

        console.log(`Restart confirmed by ${player.username} (${player.color})`);

        this.pendingRestart.confirmed.add(player.color);

        // Если оба игрока подтвердили - начинаем новую игру
        if (this.pendingRestart.confirmed.size === 2) {
            console.log("Both players confirmed restart. Starting new game...");
            this.restartGame();
        }
    }

    restartGame() {
        console.log("Restarting game with both players confirmed");
        
        // Полный сброс игры
        this.pieces = this.initializePieces();
        this.currentPlayer = 'white';
        this.gameState = 'playing';
        this.winner = null;
        this.drawOffer = null;
        this.pendingRestart = null;
        this.continueCapture = null;

        this.broadcastGameState();
        
        this.broadcast(JSON.stringify({
            type: 'gameRestarted',
            message: 'Новая игра началась!'
        }));

        console.log("New game started successfully");
    }

    resetGame() {
        console.log("Resetting game to initial state...");
        
        // Сбрасываем состояние игры
        this.pieces = this.initializePieces();
        this.currentPlayer = 'white';
        this.gameState = 'playing';
        this.winner = null;
        this.drawOffer = null;
        this.pendingRestart = null;
        this.continueCapture = null;
        
        console.log("Game reset successfully");
        this.broadcastGameState();
    }

    // ДОБАВЛЕНЫ ФУНКЦИИ ДЛЯ ОБРАБОТКИ НИЧЬИ
    handleDrawOffer(ws) {
        const player = this.players.find(p => p.ws === ws);
        if (!player) return;

        console.log(`Draw offered by ${player.username} (${player.color})`);

        // Отправляем предложение ничьи второму игроку
        this.players.forEach(p => {
            if (p.ws !== ws) {
                p.ws.send(JSON.stringify({
                    type: 'drawOffer',
                    from: player.color,
                    nickname: player.username || `Player ${player.color}`
                }));
            }
        });
    }

    handleDrawResponse(ws, accept) {
        const player = this.players.find(p => p.ws === ws);
        if (!player) return;

        console.log(`Draw response from ${player.username} (${player.color}): ${accept}`);

        if (accept) {
            // Если оба согласны - завершаем игру ничьей
            this.endGame('draw');
        } else {
            // Уведомляем другого игрока об отказе
            this.players.forEach(p => {
                if (p.ws !== ws) {
                    p.ws.send(JSON.stringify({
                        type: 'drawRejected',
                        from: player.color
                    }));
                }
            });
        }
    }

    handleMove(moveData, ws) {
        const player = this.players.find(p => p.ws === ws);
        if (!player) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Игрок не найден'
            }));
            return;
        }

        // ПРОВЕРКА ДЛЯ МНОЖЕСТВЕННОГО ВЗЯТИЯ
        if (this.continueCapture && this.continueCapture.player === player.color) {
            // Игрок продолжает взятие - проверяем, что ход идет от правильной позиции
            if (moveData.fromRow !== this.continueCapture.position.row || 
                moveData.fromCol !== this.continueCapture.position.col) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Продолжайте взятие с текущей позиции'
                }));
                return;
            }
        } else if (player.color !== this.currentPlayer) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Сейчас не ваш ход'
            }));
            return;
        }

        const validation = this.validateMove(moveData);
        if (validation.valid) {
            this.executeMove(moveData, validation);
            this.checkForKing(moveData.toRow, moveData.toCol);
            
            // Сбрасываем предложение ничьи после хода
            this.drawOffer = null;
            
            // ПРОВЕРКА ПРОДОЛЖЕНИЯ ВЗЯТИЯ
            if (validation.capturedPiece) {
                const canContinue = this.canContinueCapture(moveData.toRow, moveData.toCol);
                
                if (canContinue) {
                    console.log(`Player ${player.color} can continue capturing`);
                    // Сохраняем информацию о продолжении взятия
                    this.continueCapture = {
                        player: player.color,
                        position: { row: moveData.toRow, col: moveData.toCol }
                    };
                    
                    this.broadcastGameState();
                    
                    // Уведомляем клиента о возможности продолжения взятия
                    ws.send(JSON.stringify({
                        type: 'canContinueCapture',
                        position: { row: moveData.toRow, col: moveData.toCol }
                    }));
                } else {
                    // Взятие завершено - переключаем игрока
                    this.continueCapture = null;
                    this.switchPlayer();
                    this.broadcastGameState();
                    this.checkGameOver();
                }
            } else {
                // Обычный ход без взятия
                this.continueCapture = null;
                this.switchPlayer();
                this.broadcastGameState();
                this.checkGameOver();
            }
            
            // Отправляем информацию о выполненном ходе
            this.broadcast(JSON.stringify({
                type: 'moveMade',
                data: {
                    fromRow: moveData.fromRow,
                    fromCol: moveData.fromCol,
                    toRow: moveData.toRow,
                    toCol: moveData.toCol,
                    player: player.color,
                    currentPlayer: this.currentPlayer,
                    username: player.username,
                    isCapture: !!validation.capturedPiece,
                    canContinue: !!validation.capturedPiece && this.canContinueCapture(moveData.toRow, moveData.toCol)
                }
            }));
            
            ws.send(JSON.stringify({
                type: 'moveResult',
                valid: true,
                gameState: this.getGameState(),
                canContinue: !!validation.capturedPiece && this.canContinueCapture(moveData.toRow, moveData.toCol)
            }));
        } else {
            ws.send(JSON.stringify({
                type: 'moveResult',
                valid: false,
                message: validation.message
            }));
        }
    }

    validateMove(moveData) {
        const { fromRow, fromCol, toRow, toCol } = moveData;
        
        // Проверка границ доски
        if (!this.isValidPosition(fromRow, fromCol) || !this.isValidPosition(toRow, toCol)) {
            return { valid: false, message: 'Неверные координаты' };
        }

        // Проверка существования шашки
        const piece = this.getPiece(fromRow, fromCol);
        if (!piece) {
            return { valid: false, message: 'Шашка не найдена' };
        }

        if (piece.color !== this.currentPlayer) {
            return { valid: false, message: 'Это не ваша шашка' };
        }

        // Проверка целевой клетки
        if (this.getPiece(toRow, toCol)) {
            return { valid: false, message: 'Целевая клетка занята' };
        }

        // Проверка хода по диагонали
        if (Math.abs(toRow - fromRow) !== Math.abs(toCol - fromCol)) {
            return { valid: false, message: 'Ход должен быть по диагонали' };
        }

        const rowDiff = toRow - fromRow;

        // ПРОВЕРКА ОБЯЗАТЕЛЬНЫХ ВЗЯТИЙ
        const forcedCaptures = this.getForcedCaptures(this.currentPlayer);
        const isCaptureMove = Math.abs(rowDiff) >= 2;

        if (forcedCaptures.length > 0 && !isCaptureMove) {
            return { valid: false, message: 'Обязательно брать шашку!' };
        }

        // Проверка обязательных взятий
        if (forcedCaptures.length > 0) {
            if (!isCaptureMove) {
                return { valid: false, message: 'Обязательно брать шашку!' };
            }
            
            // Проверка взятия для дамки и простой шашки
            if (piece.isKing) {
                const validation = this.validateKingCapture(fromRow, fromCol, toRow, toCol, piece);
                if (!validation.valid) {
                    return { valid: false, message: validation.message };
                }
                return validation;
            } else {
                // ИСПРАВЛЕННАЯ ПРОВЕРКА ВЗЯТИЯ ДЛЯ ПРОСТОЙ ШАШКИ - ТОЛЬКО ЧЕРЕЗ 1 КЛЕТКУ
                if (Math.abs(rowDiff) !== 2) {
                    return { valid: false, message: 'Простая шашка должна бить через 1 клетку' };
                }
                
                const captureRow = fromRow + (toRow - fromRow) / 2;
                const captureCol = fromCol + (toCol - fromCol) / 2;
                const capturedPiece = this.getPiece(captureRow, captureCol);
                
                if (!capturedPiece || capturedPiece.color === piece.color) {
                    return { valid: false, message: 'Неверное взятие' };
                }
                
                return { 
                    valid: true, 
                    capturedPiece: { row: captureRow, col: captureCol } 
                };
            }
        }

        // Проверка обычного хода для простой шашки
        if (!piece.isKing) {
            const direction = piece.color === 'white' ? -1 : 1;
            if (Math.abs(rowDiff) !== 1) {
                return { valid: false, message: 'Простая шашка ходит на одну клетку' };
            }
            if (rowDiff * direction < 0) {
                return { valid: false, message: 'Простая шашка не может ходить назад' };
            }
        }

        // Для дамки проверяем свободный путь
        if (piece.isKing && !this.isPathClear(fromRow, fromCol, toRow, toCol)) {
            return { valid: false, message: 'Путь для дамки занят' };
        }

        return { valid: true };
    }

    validateKingCapture(fromRow, fromCol, toRow, toCol, piece) {
        const rowStep = toRow > fromRow ? 1 : -1;
        const colStep = toCol > fromCol ? 1 : -1;
        
        let currentRow = fromRow + rowStep;
        let currentCol = fromCol + colStep;
        let capturedPiece = null;
        let captureCount = 0;
        
        while (currentRow !== toRow || currentCol !== toCol) {
            const targetPiece = this.getPiece(currentRow, currentCol);
            
            if (targetPiece) {
                if (targetPiece.color !== piece.color) {
                    if (capturedPiece) {
                        // Уже нашли одну шашку для взятия, вторая на пути - ошибка
                        return { valid: false, message: 'Можно брать только одну шашку за ход' };
                    }
                    capturedPiece = { row: currentRow, col: currentCol };
                    captureCount++;
                } else {
                    // Своя шашка на пути
                    return { valid: false, message: 'На пути своя шашка' };
                }
            }
            
            currentRow += rowStep;
            currentCol += colStep;
        }
        
        if (captureCount === 1) {
            return { 
                valid: true, 
                capturedPiece: capturedPiece 
            };
        } else {
            return { valid: false, message: 'Дамка должна брать ровно одну шашку' };
        }
    }

    executeMove(moveData, validation) {
        const { fromRow, fromCol, toRow, toCol } = moveData;
        const piece = this.getPiece(fromRow, fromCol);
        
        // Обновление позиции
        piece.row = toRow;
        piece.col = toCol;
        
        // Удаление взятой шашки
        if (validation.capturedPiece) {
            this.removePiece(validation.capturedPiece.row, validation.capturedPiece.col);
        }
    }

    checkForKing(row, col) {
        const piece = this.getPiece(row, col);
        if (!piece.isKing) {
            if ((piece.color === 'white' && row === 0) || 
                (piece.color === 'black' && row === 7)) {
                piece.isKing = true;
                console.log(`Piece at ${row},${col} became a king!`);
            }
        }
    }

    canContinueCapture(row, col) {
        const piece = this.getPiece(row, col);
        const captures = this.getPossibleCaptures(piece);
        return captures.length > 0;
    }

    getForcedCaptures(color) {
        const captures = [];
        this.pieces.forEach(piece => {
            if (piece.color === color) {
                captures.push(...this.getPossibleCaptures(piece));
            }
        });
        return captures;
    }

    getPossibleCaptures(piece) {
        const captures = [];
        
        const directions = [
            { rowDir: -1, colDir: -1 }, // вверх-влево
            { rowDir: -1, colDir: 1 },  // вверх-вправо  
            { rowDir: 1, colDir: -1 },  // вниз-влево
            { rowDir: 1, colDir: 1 }    // вниз-вправо
        ];
        
        directions.forEach(({ rowDir, colDir }) => {
            if (piece.isKing) {
                let foundOpponent = false;
                let captureRow, captureCol;
                
                let currentRow = piece.row + rowDir;
                let currentCol = piece.col + colDir;
                
                // Ищем вражескую шашку
                while (this.isValidPosition(currentRow, currentCol) && !foundOpponent) {
                    const targetPiece = this.getPiece(currentRow, currentCol);
                    
                    if (targetPiece) {
                        if (targetPiece.color !== piece.color) {
                            foundOpponent = true;
                            captureRow = currentRow;
                            captureCol = currentCol;
                        } else {
                            break; // Своя шашка - прерываем
                        }
                    }
                    currentRow += rowDir;
                    currentCol += colDir;
                }
                
                // Если нашли врага, ищем куда можно встать после взятия
                if (foundOpponent) {
                    let landRow = captureRow + rowDir;
                    let landCol = captureCol + colDir;
                    
                    while (this.isValidPosition(landRow, landCol)) {
                        if (!this.getPiece(landRow, landCol)) {
                            captures.push({
                                fromRow: piece.row,
                                fromCol: piece.col,
                                toRow: landRow,
                                toCol: landCol,
                                captureRow: captureRow,
                                captureCol: captureCol
                            });
                        } else {
                            break; // Клетка занята
                        }
                        landRow += rowDir;
                        landCol += colDir;
                    }
                }
            } else {
                // ИСПРАВЛЕННАЯ ЛОГИКА ДЛЯ ПРОСТЫХ ШАШЕК - ТОЛЬКО ЧЕРЕЗ 1 КЛЕТКУ
                const captureRow = piece.row + rowDir;
                const captureCol = piece.col + colDir;
                const landRow = piece.row + 2 * rowDir;
                const landCol = piece.col + 2 * colDir;
                
                if (this.isValidPosition(captureRow, captureCol) && 
                    this.isValidPosition(landRow, landCol)) {
                    const capturedPiece = this.getPiece(captureRow, captureCol);
                    const landingCell = this.getPiece(landRow, landCol);
                    
                    if (capturedPiece && capturedPiece.color !== piece.color && !landingCell) {
                        captures.push({
                            fromRow: piece.row,
                            fromCol: piece.col,
                            toRow: landRow,
                            toCol: landCol,
                            captureRow: captureRow,
                            captureCol: captureCol
                        });
                    }
                }
            }
        });
        
        return captures;
    }

    getPiece(row, col) {
        return this.pieces.find(p => p.row === row && p.col === col);
    }

    removePiece(row, col) {
        const index = this.pieces.findIndex(p => p.row === row && p.col === col);
        if (index !== -1) {
            this.pieces.splice(index, 1);
        }
    }

    isValidPosition(row, col) {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    isPathClear(fromRow, fromCol, toRow, toCol) {
        const rowStep = toRow > fromRow ? 1 : -1;
        const colStep = toCol > fromCol ? 1 : -1;
        
        let currentRow = fromRow + rowStep;
        let currentCol = fromCol + colStep;
        
        while (currentRow !== toRow || currentCol !== toCol) {
            if (this.getPiece(currentRow, currentCol)) {
                return false;
            }
            currentRow += rowStep;
            currentCol += colStep;
        }
        
        return true;
    }

    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        console.log(`Switched to ${this.currentPlayer}'s turn`);
    }

    checkGameOver() {
        const whitePieces = this.pieces.filter(p => p.color === 'white');
        const blackPieces = this.pieces.filter(p => p.color === 'black');
        
        if (whitePieces.length === 0) {
            this.endGame('black');
        } else if (blackPieces.length === 0) {
            this.endGame('white');
        } else if (!this.canPlayerMove(this.currentPlayer)) {
            this.endGame(this.currentPlayer === 'white' ? 'black' : 'white');
        }
    }

    canPlayerMove(color) {
        // УЧИТЫВАЕМ МНОЖЕСТВЕННОЕ ВЗЯТИЕ
        if (this.continueCapture && this.continueCapture.player === color) {
            return true; // Игрок может продолжать взятие
        }
        
        return this.pieces.some(piece => {
            if (piece.color === color) {
                const moves = this.getPossibleMoves(piece);
                return moves.length > 0;
            }
            return false;
        });
    }

    getPossibleMoves(piece) {
        // УЧИТЫВАЕМ ОБЯЗАТЕЛЬНЫЕ ВЗЯТИЯ
        const forcedCaptures = this.getForcedCaptures(piece.color);
        if (forcedCaptures.length > 0) {
            // Возвращаем только взятия для этой шашки
            return forcedCaptures.filter(capture => 
                capture.fromRow === piece.row && capture.fromCol === piece.col
            );
        }
        
        // Затем обычные ходы
        const moves = [];
        const directions = piece.isKing ? [-1, 1] : [piece.color === 'white' ? -1 : 1];
        
        directions.forEach(rowDir => {
            [-1, 1].forEach(colDir => {
                if (piece.isKing) {
                    // Дамка может ходить на несколько клеток
                    let currentRow = piece.row + rowDir;
                    let currentCol = piece.col + colDir;
                    
                    while (this.isValidPosition(currentRow, currentCol)) {
                        if (!this.getPiece(currentRow, currentCol)) {
                            moves.push({
                                fromRow: piece.row,
                                fromCol: piece.col,
                                toRow: currentRow,
                                toCol: currentCol
                            });
                            currentRow += rowDir;
                            currentCol += colDir;
                        } else {
                            break;
                        }
                    }
                } else {
                    // Простая шашка - только на 1 клетку
                    const newRow = piece.row + rowDir;
                    const newCol = piece.col + colDir;
                    
                    if (this.isValidPosition(newRow, newCol) && !this.getPiece(newRow, newCol)) {
                        moves.push({
                            fromRow: piece.row,
                            fromCol: piece.col,
                            toRow: newRow,
                            toCol: newCol
                        });
                    }
                }
            });
        });
        
        return moves;
    }

    endGame(winner) {
        this.gameState = 'finished';
        this.winner = winner;
        this.continueCapture = null;
        console.log(`Game over! Winner: ${winner}`);
        
        // Получаем никнеймы игроков для отображения в финальном окне
        const winnerPlayer = this.players.find(p => p.color === winner);
        const winnerUsername = winnerPlayer ? winnerPlayer.username : null;
        
        // ДОБАВЛЕНА ЗАДЕРЖКА 2 СЕКУНДЫ ПЕРЕД ОТПРАВКОЙ СООБЩЕНИЯ
        setTimeout(() => {
            this.broadcast(JSON.stringify({
                type: 'gameOver',
                winner: winner,
                winnerUsername: winnerUsername,
                result: winner ? 'win' : 'draw'
            }));
        }, 2000);
    }

    broadcastGameState() {
        const gameState = {
            type: 'gameState',
            data: this.getGameState()
        };
        
        this.broadcast(JSON.stringify(gameState));
    }

    broadcastPlayersInfo() {
        const playersInfo = {
            type: 'playersInfo',
            data: this.players.map(p => ({
                username: p.username,
                color: p.color
            }))
        };
        
        this.broadcast(JSON.stringify(playersInfo));
    }

    broadcastGameOver() {
        const gameOver = {
            type: 'gameOver',
            winner: this.winner
        };
        
        this.broadcast(JSON.stringify(gameOver));
    }

    broadcast(message) {
        this.players.forEach(player => {
            if (player.ws.readyState === WebSocket.OPEN) {
                player.ws.send(message);
            }
        });
    }

    getGameState() {
        return {
            pieces: [...this.pieces],
            currentPlayer: this.currentPlayer,
            gameState: this.gameState,
            continueCapture: this.continueCapture
        };
    }
}

let game = new CheckersGameServer();

wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection');
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received message type:', data.type);
            
            switch (data.type) {
                case 'join':
                    game.addPlayer(ws, data.username);
                    break;
                    
                case 'setNickname': // ДОБАВЛЕН ОБРАБОТЧИК ДЛЯ НИКНЕЙМА
                    game.setPlayerNickname(ws, data.nickname);
                    break;
                    
                case 'move':
                    game.handleMove(data.data, ws);
                    break;
                    
                case 'newGame':
                    console.log("Received new game request");
                    game.handleNewGame(ws);
                    break;
                    
                case 'confirmRestart':
                    console.log("Received restart confirmation");
                    game.handleRestartConfirm(ws);
                    break;
                    
                case 'drawOffer': // ДОБАВЛЕН ОБРАБОТЧИК ДЛЯ ПРЕДЛОЖЕНИЯ НИЧЬИ
                    game.handleDrawOffer(ws);
                    break;
                    
                case 'drawResponse': // ДОБАВЛЕН ОБРАБОТЧИК ДЛЯ ОТВЕТА НА НИЧЬЮ
                    game.handleDrawResponse(ws, data.accept);
                    break;
                    
                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong' }));
                    break;
                    
                default:
                    console.log('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format'
            }));
        }
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed');
        game.removePlayer(ws);
    });
});

// Обработка graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check available at http://localhost:${PORT}/health`);
});
