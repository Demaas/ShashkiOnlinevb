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
        this.gameState = {
            board: this.createBoard(),
            currentPlayer: 'white',
            players: []
        };
        
        this.setupExpress();
        this.setupWebSocket();
    }

    setupExpress() {
        this.app.use(express.static(path.join(__dirname)));
        
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'index.html'));
        });
    }

    setupWebSocket() {
        this.wss.on('connection', (ws) => {
            console.log('New client connected');
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    this.handleMessage(ws, message);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            });

            ws.on('close', () => {
                this.handleDisconnection(ws);
            });
        });
    }

    handleMessage(ws, message) {
        switch (message.type) {
            case 'join':
                this.handleJoin(ws, message.data);
                break;
            case 'move':
                this.handleMove(ws, message.data);
                break;
            case 'newGame':
                this.handleNewGame(ws);
                break;
            case 'drawOffer':
                this.handleDrawOffer(ws);
                break;
            case 'drawResponse':
                this.handleDrawResponse(ws, message.data);
                break;
        }
    }

    handleJoin(ws, data) {
        const nick = data.nick;
        
        if (this.players.size >= 2) {
            this.sendToClient(ws, 'error', { message: 'Игра уже заполнена' });
            return;
        }

        // Определяем цвет игрока
        let color;
        if (!this.gameState.players.find(p => p.color === 'white')) {
            color = 'white';
        } else if (!this.gameState.players.find(p => p.color === 'black')) {
            color = 'black';
        } else {
            color = 'white'; // На случай, если нужно переподключение
        }

        this.players.set(ws, { nick, color, ws });
        this.gameState.players.push({ nick, color });

        // Отправляем игроку его цвет
        this.sendToClient(ws, 'playerAssigned', { color });

        // Отправляем текущее состояние игры
        this.sendToClient(ws, 'gameState', this.gameState);

        console.log(`Player ${nick} joined as ${color}`);

        // Уведомляем всех игроков о новом подключении
        this.sendToAll('gameState', this.gameState);

        // Если подключились оба игрока, отправляем уведомление
        if (this.players.size === 2) {
            this.sendToAll('opponentJoined', {
                opponentNick: nick
            });
        }
    }

    handleDisconnection(ws) {
        const player = this.players.get(ws);
        if (player) {
            console.log(`Player ${player.nick} disconnected`);
            
            // Удаляем игрока из списка
            this.players.delete(ws);
            this.gameState.players = this.gameState.players.filter(p => p.nick !== player.nick);
            
            // Уведомляем оставшегося игрока
            this.sendToAll('playerLeft');
            this.sendToAll('gameState', this.gameState);
        }
    }

    handleMove(ws, data) {
        const player = this.players.get(ws);
        if (!player || player.color !== this.gameState.currentPlayer) {
            return;
        }

        const { fromRow, fromCol, toRow, toCol } = data;
        
        if (this.validateMove(fromRow, fromCol, toRow, toCol)) {
            // Выполняем ход
            const piece = this.gameState.board[fromRow][fromCol];
            this.gameState.board[fromRow][fromCol] = null;
            this.gameState.board[toRow][toCol] = piece;

            // Проверяем превращение в дамку
            if (piece.color === 'white' && toRow === 7) {
                piece.king = true;
            } else if (piece.color === 'black' && toRow === 0) {
                piece.king = true;
            }

            // Меняем текущего игрока
            this.gameState.currentPlayer = this.gameState.currentPlayer === 'white' ? 'black' : 'white';

            // Отправляем обновленное состояние всем игрокам
            this.sendToAll('moveMade', {
                board: this.gameState.board,
                currentPlayer: this.gameState.currentPlayer,
                from: { row: fromRow, col: fromCol },
                to: { row: toRow, col: toCol }
            });

            // Проверяем окончание игры
            this.checkGameOver();
        }
    }

    handleNewGame(ws) {
        // Сбрасываем игру
        this.gameState.board = this.createBoard();
        this.gameState.currentPlayer = 'white';
        
        // Сохраняем игроков, но сбрасываем их готовность
        this.gameState.players = Array.from(this.players.values()).map(player => ({
            nick: player.nick,
            color: player.color
        }));

        this.sendToAll('gameState', this.gameState);
        console.log('New game started');
    }

    handleDrawOffer(ws) {
        const player = this.players.get(ws);
        if (!player) return;

        // Отправляем предложение ничьи другому игроку
        const otherPlayer = Array.from(this.players.values()).find(p => p.ws !== ws);
        if (otherPlayer) {
            this.sendToClient(otherPlayer.ws, 'drawOfferReceived');
        }
    }

    handleDrawResponse(ws, data) {
        const player = this.players.get(ws);
        if (!player) return;

        // Отправляем ответ другому игроку
        const otherPlayer = Array.from(this.players.values()).find(p => p.ws !== ws);
        if (otherPlayer) {
            this.sendToClient(otherPlayer.ws, 'drawResponse', data);
        }

        if (data.accepted) {
            this.sendToAll('gameOver', { winner: 'draw', reason: 'по соглашению' });
        }
    }

    validateMove(fromRow, fromCol, toRow, toCol) {
        // Базовая валидация хода
        // В реальной реализации здесь должна быть полная проверка правил шашек
        if (fromRow < 0 || fromRow > 7 || fromCol < 0 || fromCol > 7 ||
            toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) {
            return false;
        }

        const piece = this.gameState.board[fromRow][fromCol];
        if (!piece) return false;

        return true;
    }

    checkGameOver() {
        // Проверка условий окончания игры
        // В реальной реализации здесь должна быть полная проверка
        const whitePieces = this.countPieces('white');
        const blackPieces = this.countPieces('black');

        if (whitePieces === 0) {
            this.sendToAll('gameOver', { winner: 'black', reason: 'у белых не осталось шашек' });
        } else if (blackPieces === 0) {
            this.sendToAll('gameOver', { winner: 'white', reason: 'у черных не осталось шашек' });
        }
    }

    countPieces(color) {
        let count = 0;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.gameState.board[row][col];
                if (piece && piece.color === color) {
                    count++;
                }
            }
        }
        return count;
    }

    createBoard() {
        const board = Array(8).fill().map(() => Array(8).fill(null));
        
        // Расставляем белые шашки
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 8; col++) {
                if ((row + col) % 2 === 1) {
                    board[row][col] = { color: 'black', king: false };
                }
            }
        }
        
        // Расставляем черные шашки
        for (let row = 5; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if ((row + col) % 2 === 1) {
                    board[row][col] = { color: 'white', king: false };
                }
            }
        }
        
        return board;
    }

    sendToClient(ws, type, data = {}) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type, data }));
        }
    }

    sendToAll(type, data = {}) {
        this.wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type, data }));
            }
        });
    }

    start(port = 3000) {
        this.server.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    }
}

// Запуск сервера
const gameServer = new CheckersGameServer();
const PORT = process.env.PORT || 3000;
gameServer.start(PORT);
