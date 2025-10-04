const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Обслуживание статических файлов из текущей директории
app.use(express.static(__dirname));

// Явно обрабатываем корневой путь
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

    addPlayer(ws) {
        if (this.players.length < 2) {
            const color = this.players.length === 0 ? 'white' : 'black';
            this.players.push({ ws, color });
            
            ws.send(JSON.stringify({
                type: 'playerAssigned',
                color: color
            }));

            console.log(`Player joined as ${color}. Total players: ${this.players.length}`);
            
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
        console.log('Game started! White moves first.');
        this.broadcastGameState();
    }

    removePlayer(ws) {
        const playerIndex = this.players.findIndex(player => player.ws === ws);
        if (playerIndex !== -1) {
            const playerColor = this.players[playerIndex].color;
            this.players.splice(playerIndex, 1);
            console.log(`Player ${playerColor} disconnected. Remaining players: ${this.players.length}`);
            
            if (this.gameState === 'playing') {
                this.gameState = 'finished';
                this.winner = this.players[0] ? this.players[0].color : null;
                this.broadcastGameOver();
            }
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

        if (player.color !== this.currentPlayer) {
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
            
            // ОТПРАВЛЯЕМ ИНФОРМАЦИЮ О ХОДЕ ВСЕМ ИГРОКАМ
            this.broadcast(JSON.stringify({
                type: 'moveMade',
                data: {
                    fromRow: moveData.fromRow,
                    fromCol: moveData.fromCol,
                    toRow: moveData.toRow,
                    toCol: moveData.toCol,
                    player: player.color
                }
            }));
            
            if (validation.capturedPiece && this.canContinueCapture(moveData.toRow, moveData.toCol)) {
                console.log(`Player ${player.color} can continue capturing`);
                this.broadcastGameState();
            } else {
                this.switchPlayer();
                this.broadcastGameState();
            }
            
            this.checkGameOver();
            
            ws.send(JSON.stringify({
                type: 'moveResult',
                valid: true,
                gameState: this.getGameState()
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
        
        if (!this.isValidPosition(fromRow, fromCol) || !this.isValidPosition(toRow, toCol)) {
            return { valid: false, message: 'Неверные координаты' };
        }

        const piece = this.getPiece(fromRow, fromCol);
        if (!piece) {
            return { valid: false, message: 'Шашка не найдена' };
        }

        if (piece.color !== this.currentPlayer) {
            return { valid: false, message: 'Это не ваша шашка' };
        }

        if (this.getPiece(toRow, toCol)) {
            return { valid: false, message: 'Целевая клетка занята' };
        }

        if (Math.abs(toRow - fromRow) !== Math.abs(toCol - fromCol)) {
            return { valid: false, message: 'Ход должен быть по диагонали' };
        }

        const rowDiff = toRow - fromRow;

        // Проверка обязательных взятий
        const forcedCaptures = this.getForcedCaptures(this.currentPlayer);
        if (forcedCaptures.length > 0) {
            const isCaptureMove = Math.abs(rowDiff) >= 2; // Для дамки ход может быть больше 2 клеток
            if (!isCaptureMove) {
                return { valid: false, message: 'Обязательно брать шашку!' };
            }
            
            // Для дамки проверяем, что на пути есть ровно одна вражеская шашка
            if (piece.isKing) {
                const captureInfo = this.findKingCapture(fromRow, fromCol, toRow, toCol);
                if (!captureInfo) {
                    return { valid: false, message: 'Неверное взятие для дамки' };
                }
                
                return { 
                    valid: true, 
                    capturedPiece: captureInfo 
                };
            } else {
                // Для простой шашки
                const captureRow = fromRow + rowDiff / 2;
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
            if (Math.abs(rowDiff) !== 1) {
                return { valid: false, message: 'Простая шашка ходит на одну клетку' };
            }
            // ПРОВЕРКА НАПРАВЛЕНИЯ: белые - вверх, черные - вниз
            const direction = piece.color === 'white' ? -1 : 1;
            if (rowDiff !== direction) {
                return { valid: false, message: 'Простая шашка ходит только вперед' };
            }
        }

        // Для дамки проверяем свободный путь
        if (piece.isKing && !this.isPathClear(fromRow, fromCol, toRow, toCol)) {
            return { valid: false, message: 'Путь для дамки занят' };
        }

        return { valid: true };
    }

    findKingCapture(fromRow, fromCol, toRow, toCol) {
        const rowStep = toRow > fromRow ? 1 : -1;
        const colStep = toCol > fromCol ? 1 : -1;
        
        let currentRow = fromRow + rowStep;
        let currentCol = fromCol + colStep;
        let foundOpponent = null;
        
        while (currentRow !== toRow || currentCol !== toCol) {
            const piece = this.getPiece(currentRow, currentCol);
            if (piece) {
                if (piece.color !== this.currentPlayer && !foundOpponent) {
                    // Нашли вражескую шашку
                    foundOpponent = { row: currentRow, col: currentCol };
                } else {
                    // Нашли вторую шашку - невалидный ход
                    return null;
                }
            }
            currentRow += rowStep;
            currentCol += colStep;
        }
        
        return foundOpponent;
    }

    executeMove(moveData, validation) {
        const { fromRow, fromCol, toRow, toCol } = moveData;
        const piece = this.getPiece(fromRow, fromCol);
        
        piece.row = toRow;
        piece.col = toCol;
        
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
        
        if (piece.isKing) {
            // ЛОГИКА ДЛЯ ДАМКИ - бить по всей длине
            for (let rowDir of [-1, 1]) {
                for (let colDir of [-1, 1]) {
                    let foundOpponent = false;
                    let captureRow, captureCol;
                    
                    // Проверяем все клетки по диагонали
                    for (let distance = 1; distance < 8; distance++) {
                        const checkRow = piece.row + rowDir * distance;
                        const checkCol = piece.col + colDir * distance;
                        
                        // Если вышли за границы - прерываем
                        if (!this.isValidPosition(checkRow, checkCol)) break;
                        
                        const targetPiece = this.getPiece(checkRow, checkCol);
                        
                        if (targetPiece) {
                            if (targetPiece.color !== piece.color && !foundOpponent) {
                                // Нашли вражескую шашку для взятия
                                foundOpponent = true;
                                captureRow = checkRow;
                                captureCol = checkCol;
                            } else {
                                // Нашли свою шашку или вторую вражескую - прерываем
                                break;
                            }
                        } else if (foundOpponent) {
                            // Нашли свободную клетку после вражеской шашки - добавляем ход
                            captures.push({
                                fromRow: piece.row,
                                fromCol: piece.col,
                                toRow: checkRow,
                                toCol: checkCol,
                                captureRow: captureRow,
                                captureCol: captureCol
                            });
                        }
                    }
                }
            }
        } else {
            // ЛОГИКА ДЛЯ ПРОСТОЙ ШАШКИ - бить в ЛЮБОМ направлении
            const directions = [-1, 1]; // Вперед и назад для взятия
            
            directions.forEach(rowDir => {
                [-1, 1].forEach(colDir => {
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
                });
            });
        }
        
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
        
        // Проверяем все клетки до целевой (исключая целевую)
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
        return this.pieces.some(piece => {
            if (piece.color === color) {
                const moves = this.getPossibleMoves(piece);
                return moves.length > 0;
            }
            return false;
        });
    }

    getPossibleMoves(piece) {
        // Сначала проверяем обязательные взятия
        const captures = this.getPossibleCaptures(piece);
        if (captures.length > 0) {
            return captures;
        }
        
        // Затем обычные ходы
        const moves = [];
        
        if (piece.isKing) {
            // Дамка может ходить на несколько клеток в любом направлении
            const directions = [-1, 1];
            
            directions.forEach(rowDir => {
                [-1, 1].forEach(colDir => {
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
                });
            });
        } else {
            // ПРОСТЫЕ ШАШКИ - ходят только ВПЕРЕД
            const direction = piece.color === 'white' ? -1 : 1; // Белые - вверх, черные - вниз
            
            // Проверяем ходы вперед по диагонали
            [-1, 1].forEach(colDir => {
                const newRow = piece.row + direction;
                const newCol = piece.col + colDir;
                
                if (this.isValidPosition(newRow, newCol) && !this.getPiece(newRow, newCol)) {
                    moves.push({
                        fromRow: piece.row,
                        fromCol: piece.col,
                        toRow: newRow,
                        toCol: newCol
                    });
                }
            });
        }
        
        return moves;
    }

    endGame(winner) {
        this.gameState = 'finished';
        this.winner = winner;
        console.log(`Game over! Winner: ${winner}`);
        this.broadcastGameOver();
    }

    broadcastGameState() {
        const gameState = {
            type: 'gameState',
            data: this.getGameState()
        };
        
        this.broadcast(JSON.stringify(gameState));
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
            gameState: this.gameState
        };
    }
}

const game = new CheckersGameServer();

wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection');
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });

    const playerColor = game.addPlayer(ws);
    
    if (playerColor === null) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Game is full. Please try again later.'
        }));
        ws.close();
        return;
    }

    ws.send(JSON.stringify({
        type: 'gameState',
        data: game.getGameState()
    }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'move':
                    game.handleMove(data.data, ws);
                    break;
                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong' }));
                    break;
                case 'restart':
                    // Обработка рестарта игры
                    console.log('Player requested restart');
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
