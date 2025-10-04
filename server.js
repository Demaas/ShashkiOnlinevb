const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

class CheckersGameServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        
        this.players = [];
        this.whitePlayer = null;
        this.blackPlayer = null;
        this.currentPlayer = 'white';
        this.gameBoard = this.createInitialBoard();
        this.gameActive = false;
        
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
            console.log('New player connected');
            
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleMessage(ws, data);
                } catch (error) {
                    console.error('Error parsing message:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Invalid message format'
                    }));
                }
            });

            ws.on('close', () => {
                console.log('Player disconnected');
                this.handleDisconnection(ws);
            });

            // Отправляем текущее состояние новому игроку
            this.sendGameState();
        });
    }

    handleMessage(ws, data) {
        switch (data.type) {
            case 'join':
                this.handleJoin(ws, data.nickname);
                break;
            case 'move':
                this.handleMove(ws, data.from, data.to);
                break;
            case 'getValidMoves':
                this.handleGetValidMoves(ws, data.row, data.col);
                break;
            case 'newGame':
                this.handleNewGame(ws);
                break;
            case 'drawOffer':
                this.handleDrawOffer(ws);
                break;
            case 'drawResponse':
                this.handleDrawResponse(ws, data.accepted);
                break;
        }
    }

    handleJoin(ws, nickname) {
        // Проверяем, не подключен ли уже игрок с таким ником
        const existingPlayer = this.players.find(player => 
            player.nickname === nickname && player.ws.readyState === WebSocket.OPEN
        );
        
        if (existingPlayer) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Игрок с таким ником уже подключен'
            }));
            return;
        }

        // Удаляем старые подключения этого игрока
        this.players = this.players.filter(player => 
            player.nickname !== nickname || player.ws.readyState !== WebSocket.OPEN
        );

        const player = {
            ws: ws,
            nickname: nickname,
            color: null
        };

        this.players.push(player);

        // Назначаем цвет игроку
        if (!this.whitePlayer) {
            this.whitePlayer = player;
            player.color = 'white';
        } else if (!this.blackPlayer) {
            this.blackPlayer = player;
            player.color = 'black';
        } else {
            // Все места заняты, игрок становится наблюдателем
            player.color = 'observer';
        }

        // Отправляем игроку его цвет
        ws.send(JSON.stringify({
            type: 'playerAssigned',
            color: player.color
        }));

        console.log(`Player ${nickname} joined as ${player.color}`);

        // Если оба игрока подключены, начинаем игру
        if (this.whitePlayer && this.blackPlayer && !this.gameActive) {
            this.gameActive = true;
            this.currentPlayer = 'white';
            this.gameBoard = this.createInitialBoard();
        }

        this.sendGameState();
    }

    handleDisconnection(ws) {
        const disconnectedPlayer = this.players.find(player => player.ws === ws);
        
        if (disconnectedPlayer) {
            console.log(`Player ${disconnectedPlayer.nickname} disconnected`);
            
            if (disconnectedPlayer === this.whitePlayer) {
                this.whitePlayer = null;
            } else if (disconnectedPlayer === this.blackPlayer) {
                this.blackPlayer = null;
            }
            
            this.players = this.players.filter(player => player.ws !== ws);
            
            // Если один из игроков отключился, завершаем игру
            if (this.gameActive && (disconnectedPlayer === this.whitePlayer || disconnectedPlayer === this.blackPlayer)) {
                this.gameActive = false;
                this.broadcast(JSON.stringify({
                    type: 'gameOver',
                    winner: disconnectedPlayer.color === 'white' ? 'black' : 'white',
                    reason: 'disconnection'
                }));
            }
            
            this.sendGameState();
        }
    }

    createInitialBoard() {
        const board = Array(8).fill().map(() => Array(8).fill(null));
        
        // Расставляем чёрные шашки
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 8; col++) {
                if ((row + col) % 2 !== 0) {
                    board[row][col] = { color: 'black', king: false };
                }
            }
        }
        
        // Расставляем белые шашки
        for (let row = 5; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if ((row + col) % 2 !== 0) {
                    board[row][col] = { color: 'white', king: false };
                }
            }
        }
        
        return board;
    }

    handleMove(ws, from, to) {
        if (!this.gameActive) return;
        
        const player = this.players.find(p => p.ws === ws);
        if (!player || player.color !== this.currentPlayer) return;
        
        if (this.validateMove(from, to, player.color)) {
            this.executeMove(from, to);
            
            // Проверяем превращение в дамку
            this.checkForKing(to);
            
            // Проверяем окончание игры
            const winner = this.checkWinner();
            if (winner) {
                this.broadcast(JSON.stringify({
                    type: 'gameOver',
                    winner: winner,
                    reason: 'checkmate'
                }));
                this.gameActive = false;
            } else {
                // Передаём ход следующему игроку
                this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
                
                // Отправляем информацию о ходе со стрелкой направления
                this.broadcast(JSON.stringify({
                    type: 'moveMade',
                    board: this.gameBoard,
                    currentPlayer: this.currentPlayer,
                    from: from,
                    to: to
                }));
            }
        }
    }

    validateMove(from, to, playerColor) {
        // Проверяем границы доски
        if (from.row < 0 || from.row >= 8 || from.col < 0 || from.col >= 8 ||
            to.row < 0 || to.row >= 8 || to.col < 0 || to.col >= 8) {
            return false;
        }
        
        const piece = this.gameBoard[from.row][from.col];
        if (!piece || piece.color !== playerColor) return false;
        
        // Проверяем, что целевая клетка пуста
        if (this.gameBoard[to.row][to.col]) return false;
        
        // Проверяем обязательное взятие
        const mandatoryCaptures = this.getMandatoryCaptures(playerColor);
        if (mandatoryCaptures.length > 0) {
            const isCaptureMove = Math.abs(from.row - to.row) === 2 && Math.abs(from.col - to.col) === 2;
            if (!isCaptureMove) return false;
            
            // Проверяем, что это одно из обязательных взятий
            const isValidCapture = mandatoryCaptures.some(capture =>
                capture.from.row === from.row && capture.from.col === from.col &&
                capture.to.row === to.row && capture.to.col === to.col
            );
            if (!isValidCapture) return false;
        }
        
        const rowDiff = to.row - from.row;
        const colDiff = to.col - from.col;
        
        // Проверяем направление движения для простых шашек
        if (!piece.king) {
            if (piece.color === 'white' && rowDiff >= 0) return false;
            if (piece.color === 'black' && rowDiff <= 0) return false;
        }
        
        // Проверяем диагональное движение
        if (Math.abs(rowDiff) !== Math.abs(colDiff)) return false;
        
        // Проверяем обычный ход (без взятия)
        if (Math.abs(rowDiff) === 1) {
            return mandatoryCaptures.length === 0;
        }
        
        // Проверяем взятие
        if (Math.abs(rowDiff) === 2) {
            const captureRow = from.row + rowDiff / 2;
            const captureCol = from.col + colDiff / 2;
            const capturedPiece = this.gameBoard[captureRow][captureCol];
            
            return capturedPiece && capturedPiece.color !== playerColor;
        }
        
        // Для дамок проверяем путь
        if (piece.king && Math.abs(rowDiff) > 2) {
            return this.validateKingMove(from, to, playerColor);
        }
        
        return false;
    }

    validateKingMove(from, to, playerColor) {
        const rowStep = to.row > from.row ? 1 : -1;
        const colStep = to.col > from.col ? 1 : -1;
        
        let currentRow = from.row + rowStep;
        let currentCol = from.col + colStep;
        let captureFound = false;
        
        while (currentRow !== to.row && currentCol !== to.col) {
            const piece = this.gameBoard[currentRow][currentCol];
            
            if (piece) {
                if (piece.color === playerColor) return false;
                if (captureFound) return false; // Нельзя брать больше одной шашки
                captureFound = true;
                // Пропускаем клетку с взятой шашкой
                currentRow += rowStep;
                currentCol += colStep;
                continue;
            }
            
            currentRow += rowStep;
            currentCol += colStep;
        }
        
        return true;
    }

    getMandatoryCaptures(playerColor) {
        const captures = [];
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.gameBoard[row][col];
                if (piece && piece.color === playerColor) {
                    const pieceCaptures = this.getPossibleCaptures(row, col);
                    captures.push(...pieceCaptures);
                }
            }
        }
        
        return captures;
    }

    getPossibleCaptures(row, col) {
        const piece = this.gameBoard[row][col];
        if (!piece) return [];
        
        const captures = [];
        const directions = piece.king ? 
            [[-1, -1], [-1, 1], [1, -1], [1, 1]] :
            piece.color === 'white' ? 
                [[-1, -1], [-1, 1]] : 
                [[1, -1], [1, 1]];
        
        for (const [rowDir, colDir] of directions) {
            if (piece.king) {
                // Логика взятий для дамки
                let currentRow = row + rowDir;
                let currentCol = col + colDir;
                let captureFound = false;
                
                while (currentRow >= 0 && currentRow < 8 && currentCol >= 0 && currentCol < 8) {
                    const targetPiece = this.gameBoard[currentRow][currentCol];
                    
                    if (targetPiece) {
                        if (targetPiece.color === piece.color) break;
                        if (captureFound) break;
                        
                        captureFound = true;
                        // Проверяем клетку после шашки противника
                        const nextRow = currentRow + rowDir;
                        const nextCol = currentCol + colDir;
                        
                        if (nextRow >= 0 && nextRow < 8 && nextCol >= 0 && nextCol < 8 &&
                            !this.gameBoard[nextRow][nextCol]) {
                            captures.push({
                                from: { row, col },
                                to: { row: nextRow, col: nextCol }
                            });
                        }
                        break;
                    }
                    
                    currentRow += rowDir;
                    currentCol += colDir;
                }
            } else {
                // Логика взятий для простой шашки
                const captureRow = row + rowDir * 2;
                const captureCol = col + colDir * 2;
                
                if (captureRow >= 0 && captureRow < 8 && captureCol >= 0 && captureCol < 8) {
                    const middlePiece = this.gameBoard[row + rowDir][col + colDir];
                    const targetCell = this.gameBoard[captureRow][captureCol];
                    
                    if (middlePiece && middlePiece.color !== piece.color && !targetCell) {
                        captures.push({
                            from: { row, col },
                            to: { row: captureRow, col: captureCol }
                        });
                    }
                }
            }
        }
        
        return captures;
    }

    executeMove(from, to) {
        const piece = this.gameBoard[from.row][from.col];
        this.gameBoard[from.row][from.col] = null;
        this.gameBoard[to.row][to.col] = piece;
        
        // Удаляем взятую шашку
        const rowDiff = to.row - from.row;
        const colDiff = to.col - from.col;
        
        if (Math.abs(rowDiff) === 2) {
            const captureRow = from.row + rowDiff / 2;
            const captureCol = from.col + colDiff / 2;
            this.gameBoard[captureRow][captureCol] = null;
        } else if (Math.abs(rowDiff) > 2 && piece.king) {
            // Удаление шашки при взятии дамкой
            const rowStep = rowDiff > 0 ? 1 : -1;
            const colStep = colDiff > 0 ? 1 : -1;
            
            let currentRow = from.row + rowStep;
            let currentCol = from.col + colStep;
            
            while (currentRow !== to.row && currentCol !== to.col) {
                if (this.gameBoard[currentRow][currentCol]) {
                    this.gameBoard[currentRow][currentCol] = null;
                    break;
                }
                currentRow += rowStep;
                currentCol += colStep;
            }
        }
    }

    checkForKing(position) {
        const piece = this.gameBoard[position.row][position.col];
        if (!piece) return;
        
        if ((piece.color === 'white' && position.row === 0) ||
            (piece.color === 'black' && position.row === 7)) {
            piece.king = true;
        }
    }

    checkWinner() {
        let whitePieces = 0;
        let blackPieces = 0;
        let whiteHasMoves = false;
        let blackHasMoves = false;
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.gameBoard[row][col];
                if (piece) {
                    if (piece.color === 'white') {
                        whitePieces++;
                        if (!whiteHasMoves) {
                            whiteHasMoves = this.hasValidMoves(row, col);
                        }
                    } else {
                        blackPieces++;
                        if (!blackHasMoves) {
                            blackHasMoves = this.hasValidMoves(row, col);
                        }
                    }
                }
            }
        }
        
        if (whitePieces === 0 || !whiteHasMoves) return 'black';
        if (blackPieces === 0 || !blackHasMoves) return 'white';
        return null;
    }

    hasValidMoves(row, col) {
        const piece = this.gameBoard[row][col];
        if (!piece) return false;
        
        // Проверяем обычные ходы
        const directions = piece.king ? 
            [[-1, -1], [-1, 1], [1, -1], [1, 1]] :
            piece.color === 'white' ? 
                [[-1, -1], [-1, 1]] : 
                [[1, -1], [1, 1]];
        
        for (const [rowDir, colDir] of directions) {
            const newRow = row + rowDir;
            const newCol = col + colDir;
            
            if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
                if (!this.gameBoard[newRow][newCol]) {
                    return true;
                }
            }
            
            // Проверяем взятия
            const captureRow = row + rowDir * 2;
            const captureCol = col + colDir * 2;
            
            if (captureRow >= 0 && captureRow < 8 && captureCol >= 0 && captureCol < 8) {
                const middlePiece = this.gameBoard[row + rowDir][col + colDir];
                const targetCell = this.gameBoard[captureRow][captureCol];
                
                if (middlePiece && middlePiece.color !== piece.color && !targetCell) {
                    return true;
                }
            }
        }
        
        return false;
    }

    handleGetValidMoves(ws, row, col) {
        const player = this.players.find(p => p.ws === ws);
        if (!player) return;
        
        const piece = this.gameBoard[row][col];
        if (!piece || piece.color !== player.color) return;
        
        const validMoves = this.getValidMoves(row, col);
        ws.send(JSON.stringify({
            type: 'validMoves',
            moves: validMoves
        }));
    }

    getValidMoves(row, col) {
        const mandatoryCaptures = this.getMandatoryCaptures(this.gameBoard[row][col].color);
        
        if (mandatoryCaptures.length > 0) {
            return mandatoryCaptures
                .filter(capture => capture.from.row === row && capture.from.col === col)
                .map(capture => ({ row: capture.to.row, col: capture.to.col }));
        }
        
        const moves = [];
        const piece = this.gameBoard[row][col];
        const directions = piece.king ? 
            [[-1, -1], [-1, 1], [1, -1], [1, 1]] :
            piece.color === 'white' ? 
                [[-1, -1], [-1, 1]] : 
                [[1, -1], [1, 1]];
        
        for (const [rowDir, colDir] of directions) {
            const newRow = row + rowDir;
            const newCol = col + colDir;
            
            if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
                if (!this.gameBoard[newRow][newCol]) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }
        
        return moves;
    }

    handleNewGame(ws) {
        const player = this.players.find(p => p.ws === ws);
        if (!player) return;
        
        // Сбрасываем игру
        this.gameBoard = this.createInitialBoard();
        this.currentPlayer = 'white';
        this.gameActive = true;
        
        this.broadcast(JSON.stringify({
            type: 'gameState',
            board: this.gameBoard,
            currentPlayer: this.currentPlayer,
            players: this.getPlayersInfo()
        }));
    }

    handleDrawOffer(ws) {
        const player = this.players.find(p => p.ws === ws);
        if (!player || !this.gameActive) return;
        
        // Отправляем предложение ничьи другому игроку
        const opponent = player.color === 'white' ? this.blackPlayer : this.whitePlayer;
        if (opponent) {
            opponent.ws.send(JSON.stringify({
                type: 'drawOfferReceived',
                from: player.nickname
            }));
        }
    }

    handleDrawResponse(ws, accepted) {
        if (accepted) {
            this.broadcast(JSON.stringify({
                type: 'gameOver',
                winner: 'draw',
                reason: 'agreement'
            }));
            this.gameActive = false;
        } else {
            // Уведомляем о отклонении предложения
            const player = this.players.find(p => p.ws === ws);
            const opponent = player.color === 'white' ? this.blackPlayer : this.whitePlayer;
            if (opponent) {
                opponent.ws.send(JSON.stringify({
                    type: 'drawResponse',
                    accepted: false
                }));
            }
        }
    }

    // НОВЫЙ МЕТОД: Получение информации об игроках для отправки клиентам
    getPlayersInfo() {
        return {
            white: this.whitePlayer ? this.whitePlayer.nickname : null,
            black: this.blackPlayer ? this.blackPlayer.nickname : null
        };
    }

    sendGameState() {
        const gameState = {
            type: 'gameState',
            board: this.gameBoard,
            currentPlayer: this.currentPlayer,
            players: this.getPlayersInfo()  // Добавлена информация об игроках
        };
        
        this.broadcast(JSON.stringify(gameState));
    }

    broadcast(message) {
        this.wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    start(port = process.env.PORT || 3000) {
        this.server.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    }
}

// Запуск сервера
const gameServer = new CheckersGameServer();
gameServer.start();
