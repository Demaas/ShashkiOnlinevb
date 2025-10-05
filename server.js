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

    // ★★★ ДОБАВЛЕННЫЙ МЕТОД ДЛЯ НОВОЙ ИГРЫ ★★★
    resetGame() {
        console.log("Resetting game to initial state...");
        
        // Сбрасываем состояние игры
        this.pieces = this.initializePieces();
        this.currentPlayer = 'white';
        this.gameState = 'playing';
        this.winner = null;
        this.drawOffer = null;
        
        console.log("Game reset successfully");
        this.broadcastGameState();
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
            
            // Сбрасываем предложение ничьи после хода
            this.drawOffer = null;
            
            // Проверка возможности продолжения взятия
            if (validation.capturedPiece && this.canContinueCapture(moveData.toRow, moveData.toCol)) {
                console.log(`Player ${player.color} can continue capturing`);
                this.broadcastGameState();
                
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
                        username: player.username
                    }
                }));
            } else {
                this.switchPlayer();
                this.broadcastGameState();
                this.checkGameOver();
                
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
                        username: player.username
                    }
                }));
            }
            
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
        const direction = piece.color === 'white' ? -1 : 1;

        // Проверка обязательных взятий
        const forcedCaptures = this.getForcedCaptures(this.currentPlayer);
        if (forcedCaptures.length > 0) {
            const isCaptureMove = Math.abs(rowDiff) === 2;
            if (!isCaptureMove) {
                return { valid: false, message: 'Обязательно брать шашку!' };
            }
            
            // Проверка взятия
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

        // Проверка обычного хода для простой шашки
        if (!piece.isKing) {
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
        const directions = piece.isKing ? [-1, 1] : [piece.color === 'white' ? -1 : 1];
        
        directions.forEach(rowDir => {
            [-1, 1].forEach(colDir => {
                if (piece.isKing) {
                    // Логика взятия для дамки
                    let currentRow = piece.row + rowDir;
                    let currentCol = piece.col + colDir;
                    let foundOpponent = false;
                    
                    while (this.isValidPosition(currentRow, currentCol)) {
                        const targetPiece = this.getPiece(currentRow, currentCol);
                        
                        if (targetPiece) {
                            if (targetPiece.color !== piece.color && !foundOpponent) {
                                foundOpponent = true;
                                // Ищем свободную клетку после вражеской шашки
                                let nextRow = currentRow + rowDir;
                                let nextCol = currentCol + colDir;
                                
                                while (this.isValidPosition(nextRow, nextCol)) {
                                    if (!this.getPiece(nextRow, nextCol)) {
                                        captures.push({
                                            fromRow: piece.row,
                                            fromCol: piece.col,
                                            toRow: nextRow,
                                            toCol: nextCol,
                                            captureRow: currentRow,
                                            captureCol: currentCol
                                        });
                                    } else {
                                        break;
                                    }
                                    nextRow += rowDir;
                                    nextCol += colDir;
                                }
                            } else {
                                break;
                            }
                        }
                        
                        if (foundOpponent) break;
                        currentRow += rowDir;
                        currentCol += colDir;
                    }
                } else {
                    // Логика взятия для простой шашки
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
        console.log(`Game over! Winner: ${winner}`);
        
        this.broadcast(JSON.stringify({
            type: 'gameOver',
            winner: winner,
            result: winner ? 'win' : 'draw'
        }));
    }

    // ★★★ ДОБАВЛЕННЫЙ МЕТОД ДЛЯ ОБРАБОТКИ НИЧЬИ ★★★
    handleDrawOffer(ws, fromUsername) {
        const player = this.players.find(p => p.ws === ws);
        if (!player) return;

        this.drawOffer = { from: player.color, username: fromUsername };
        
        // Отправляем предложение ничьи другому игроку
        const opponent = this.players.find(p => p.color !== player.color);
        if (opponent) {
            opponent.ws.send(JSON.stringify({
                type: 'drawOfferReceived',
                from: fromUsername
            }));
        }
    }

    handleDrawResponse(ws, accepted) {
        const player = this.players.find(p => p.ws === ws);
        if (!player || !this.drawOffer) return;

        if (accepted) {
            // Оба игрока согласились на ничью
            this.endGame(null);
        } else {
            // Отказ от ничьи
            const opponent = this.players.find(p => p.color !== player.color);
            if (opponent) {
                opponent.ws.send(JSON.stringify({
                    type: 'drawRejected',
                    by: player.username
                }));
            }
            this.drawOffer = null;
        }
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
                    
                case 'move':
                    game.handleMove(data.data, ws);
                    break;
                    
                // ★★★ ДОБАВЛЕННАЯ ОБРАБОТКА НОВОЙ ИГРЫ ★★★
                case 'newGame':
                    console.log("Received new game request");
                    game.resetGame();
                    break;
                    
                case 'drawOffer':
                    game.handleDrawOffer(ws, data.from);
                    break;
                    
                case 'drawResponse':
                    game.handleDrawResponse(ws, data.accepted);
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
