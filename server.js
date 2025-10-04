const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

class CheckersGameServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        
        this.players = new Map();
        this.rooms = new Map();
        this.gameStates = new Map();
        
        this.setupStaticFiles();
        this.setupWebSocket();
        this.setupRoutes();
    }

    setupStaticFiles() {
        this.app.use(express.static(path.join(__dirname)));
    }

    setupRoutes() {
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'index.html'));
        });
    }

    setupWebSocket() {
        this.wss.on('connection', (ws) => {
            console.log('Новое подключение');
            
            const player = {
                socket: ws,
                room: null,
                nickname: null,
                color: null
            };

            this.players.set(ws, player);

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    this.handleMessage(player, message);
                } catch (error) {
                    console.error('Ошибка парсинга сообщения:', error);
                }
            });

            ws.on('close', () => {
                console.log('Отключение игрока:', player.nickname);
                this.handleDisconnect(player);
                this.players.delete(ws);
            });

            ws.on('error', (error) => {
                console.error('WebSocket ошибка:', error);
            });
        });
    }

    handleMessage(player, message) {
        switch (message.type) {
            case 'join':
                this.handleJoin(player, message.nickname);
                break;
            case 'move':
                this.handleMove(player, message.move);
                break;
            case 'drawOffer':
                this.handleDrawOffer(player);
                break;
            case 'drawResponse':
                this.handleDrawResponse(player, message.accepted);
                break;
            case 'newGame':
                this.handleNewGame(player);
                break;
        }
    }

    handleJoin(player, nickname) {
        player.nickname = nickname;
        
        // Поиск свободной комнаты или создание новой
        let room = this.findAvailableRoom();
        if (!room) {
            room = this.createRoom();
        }
        
        player.room = room;
        player.color = room.players.length === 0 ? 'white' : 'black';
        room.players.push(player);
        
        console.log(`Игрок ${nickname} присоединился к комнате ${room.id} как ${player.color}`);
        
        // Отправка информации игроку
        player.socket.send(JSON.stringify({
            type: 'playerAssigned',
            color: player.color
        }));
        
        // Если комната заполнена, начинаем игру
        if (room.players.length === 2) {
            this.startGame(room);
            
            // Отправка информации о соперниках обоим игрокам
            room.players.forEach(p => {
                const opponent = room.players.find(op => op !== p);
                p.socket.send(JSON.stringify({
                    type: 'opponentInfo',
                    opponentNick: opponent.nickname
                }));
            });
        }
    }

    findAvailableRoom() {
        for (let room of this.rooms.values()) {
            if (room.players.length < 2 && !room.gameActive) {
                return room;
            }
        }
        return null;
    }

    createRoom() {
        const roomId = Math.random().toString(36).substr(2, 9);
        const room = {
            id: roomId,
            players: [],
            gameActive: false,
            currentTurn: 'white',
            board: null
        };
        this.rooms.set(roomId, room);
        return room;
    }

    startGame(room) {
        room.gameActive = true;
        room.board = this.initializeBoard();
        room.drawOffered = null;
        
        this.broadcastToRoom(room, {
            type: 'gameState',
            board: room.board,
            currentTurn: room.currentTurn
        });
        
        this.updateGameStatus(room);
    }

    initializeBoard() {
        // Стандартная начальная расстановка для русских шашек
        const board = Array(8).fill().map(() => Array(8).fill(null));
        
        // Расстановка белых шашек
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 8; col++) {
                if ((row + col) % 2 === 1) {
                    board[row][col] = { type: 'man', color: 'white' };
                }
            }
        }
        
        // Расстановка черных шашек
        for (let row = 5; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if ((row + col) % 2 === 1) {
                    board[row][col] = { type: 'man', color: 'black' };
                }
            }
        }
        
        return board;
    }

    handleMove(player, move) {
        const room = player.room;
        if (!room || !room.gameActive || room.currentTurn !== player.color) {
            return;
        }
        
        const { from, to } = move;
        const [fromRow, fromCol] = from;
        const [toRow, toCol] = to;
        
        if (this.validateMove(room, player.color, from, to)) {
            this.executeMove(room, from, to);
            
            // Проверка на превращение в дамку
            this.checkForKing(room, toRow, toCol);
            
            // Смена хода
            room.currentTurn = room.currentTurn === 'white' ? 'black' : 'white';
            
            // Проверка окончания игры
            const gameResult = this.checkGameOver(room);
            if (gameResult) {
                this.handleGameOver(room, gameResult);
            } else {
                // Отправка обновленного состояния
                const moveData = {
                    type: 'moveMade',
                    board: room.board,
                    currentTurn: room.currentTurn,
                    from: from,
                    to: to
                };
                
                this.broadcastToRoom(room, moveData);
                this.updateGameStatus(room);
            }
        }
    }

    validateMove(room, playerColor, from, to) {
        const [fromRow, fromCol] = from;
        const [toRow, toCol] = to;
        
        // Базовая валидация
        if (fromRow < 0 || fromRow >= 8 || fromCol < 0 || fromCol >= 8 ||
            toRow < 0 || toRow >= 8 || toCol < 0 || toCol >= 8) {
            return false;
        }
        
        const piece = room.board[fromRow][fromCol];
        if (!piece || piece.color !== playerColor) {
            return false;
        }
        
        // Проверка обязательного взятия
        const mandatoryCaptures = this.getMandatoryCaptures(room, playerColor);
        if (mandatoryCaptures.length > 0) {
            const isCaptureMove = Math.abs(fromRow - toRow) === 2 && Math.abs(fromCol - toCol) === 2;
            if (!isCaptureMove) {
                return false;
            }
            
            const isMandatoryCapture = mandatoryCaptures.some(capture => 
                capture.from[0] === fromRow && capture.from[1] === fromCol &&
                capture.to[0] === toRow && capture.to[1] === toCol
            );
            
            if (!isMandatoryCapture) {
                return false;
            }
        }
        
        // Дополнительная логика валидации ходов...
        return true;
    }

    getMandatoryCaptures(room, playerColor) {
        const captures = [];
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = room.board[row][col];
                if (piece && piece.color === playerColor) {
                    const pieceCaptures = this.getPossibleCaptures(room, row, col);
                    captures.push(...pieceCaptures);
                }
            }
        }
        
        return captures;
    }

    getPossibleCaptures(room, row, col) {
        const captures = [];
        const piece = room.board[row][col];
        const directions = [];
        
        if (piece.type === 'man') {
            directions.push([2, 2], [2, -2], [-2, 2], [-2, -2]);
        } else { // king
            for (let i = 2; i < 8; i++) {
                directions.push([i, i], [i, -i], [-i, i], [-i, -i]);
            }
        }
        
        for (const [dRow, dCol] of directions) {
            const newRow = row + dRow;
            const newCol = col + dCol;
            
            if (this.isValidCapture(room, row, col, newRow, newCol, piece)) {
                captures.push({
                    from: [row, col],
                    to: [newRow, newCol]
                });
            }
        }
        
        return captures;
    }

    isValidCapture(room, fromRow, fromCol, toRow, toCol, piece) {
        // Логика проверки возможности взятия...
        return true;
    }

    executeMove(room, from, to) {
        const [fromRow, fromCol] = from;
        const [toRow, toCol] = to;
        const piece = room.board[fromRow][fromCol];
        
        room.board[fromRow][fromCol] = null;
        room.board[toRow][toCol] = piece;
        
        // Удаление взятой шашки
        if (Math.abs(fromRow - toRow) === 2) {
            const capturedRow = (fromRow + toRow) / 2;
            const capturedCol = (fromCol + toCol) / 2;
            room.board[capturedRow][capturedCol] = null;
        }
    }

    checkForKing(room, row, col) {
        const piece = room.board[row][col];
        if (piece && piece.type === 'man') {
            if ((piece.color === 'white' && row === 7) || 
                (piece.color === 'black' && row === 0)) {
                piece.type = 'king';
            }
        }
    }

    checkGameOver(room) {
        const whitePieces = this.countPieces(room, 'white');
        const blackPieces = this.countPieces(room, 'black');
        
        if (whitePieces === 0) {
            return { winner: 'black', reason: 'У белых не осталось шашек' };
        }
        if (blackPieces === 0) {
            return { winner: 'white', reason: 'У черных не осталось шашек' };
        }
        
        // Проверка на ничью (нет возможных ходов)
        if (!this.hasValidMoves(room, room.currentTurn)) {
            return { winner: null, reason: 'Нет возможных ходов' };
        }
        
        return null;
    }

    countPieces(room, color) {
        let count = 0;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = room.board[row][col];
                if (piece && piece.color === color) {
                    count++;
                }
            }
        }
        return count;
    }

    hasValidMoves(room, color) {
        // Логика проверки наличия валидных ходов...
        return true;
    }

    handleGameOver(room, result) {
        room.gameActive = false;
        
        this.broadcastToRoom(room, {
            type: 'gameOver',
            winner: result.winner,
            message: result.reason,
            board: room.board
        });
    }

    handleDrawOffer(player) {
        const room = player.room;
        if (!room || !room.gameActive) return;
        
        room.drawOffered = player.color;
        const opponent = room.players.find(p => p !== player);
        
        if (opponent) {
            opponent.socket.send(JSON.stringify({
                type: 'drawOfferReceived'
            }));
        }
    }

    handleDrawResponse(player, accepted) {
        const room = player.room;
        if (!room || !room.gameActive || !room.drawOffered) return;
        
        if (accepted) {
            room.gameActive = false;
            this.broadcastToRoom(room, {
                type: 'gameOver',
                winner: null,
                message: 'Игра завершена по соглашению сторон',
                board: room.board
            });
        } else {
            room.drawOffered = null;
            const opponent = room.players.find(p => p !== player);
            if (opponent) {
                opponent.socket.send(JSON.stringify({
                    type: 'drawResponse',
                    accepted: false
                }));
            }
        }
    }

    handleNewGame(player) {
        const room = player.room;
        if (!room) return;
        
        // Сброс состояния игры
        room.gameActive = false;
        room.drawOffered = null;
        
        // Если в комнате 2 игрока, начинаем новую игру
        if (room.players.length === 2) {
            // Смена цветов
            room.players.forEach(p => {
                p.color = p.color === 'white' ? 'black' : 'white';
            });
            
            this.startGame(room);
        }
    }

    handleDisconnect(player) {
        const room = player.room;
        if (!room) return;
        
        // Удаляем игрока из комнаты
        room.players = room.players.filter(p => p !== player);
        
        // Уведомляем оппонента об отключении
        const opponent = room.players.find(p => p !== player);
        if (opponent) {
            opponent.socket.send(JSON.stringify({
                type: 'opponentInfo',
                opponentNick: null
            }));
            
            opponent.socket.send(JSON.stringify({
                type: 'gameOver',
                winner: opponent.color,
                message: 'Соперник отключился',
                board: room.board
            }));
        }
        
        // Если комната пустая, удаляем ее
        if (room.players.length === 0) {
            this.rooms.delete(room.id);
        }
    }

    updateGameStatus(room) {
        const statusMessage = `${room.currentTurn === 'white' ? 'Белые' : 'Черные'} - Ход`;
        
        this.broadcastToRoom(room, {
            type: 'gameStatus',
            status: statusMessage
        });
    }

    broadcastToRoom(room, message) {
        room.players.forEach(player => {
            if (player.socket.readyState === WebSocket.OPEN) {
                player.socket.send(JSON.stringify(message));
            }
        });
    }

    start(port = process.env.PORT || 3000) {
        this.server.listen(port, () => {
            console.log(`Сервер запущен на порту ${port}`);
            console.log(`Доступен по адресу: http://localhost:${port}`);
        });
    }
}

// Запуск сервера
const gameServer = new CheckersGameServer();
gameServer.start();
