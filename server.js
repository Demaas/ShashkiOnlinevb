const WebSocket = require("ws");
const http = require("http");
const express = require("express");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Обслуживание статических файлов
app.use(express.static("."));

// Маршрут для главной страницы
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Маршрут для проверки работы сервера
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Checkers server is running" });
});

class CheckersGameServer {
  constructor() {
    this.players = [];
    this.currentPlayer = "white";
    this.pieces = this.initializePieces();
    this.gameState = "waiting";
    this.winner = null;
    this.drawOffer = null;
    this.pendingRestart = null;
    this.continueCapture = null; // ★★★ ДОБАВЛЕНО ДЛЯ МНОЖЕСТВЕННОГО ВЗЯТИЯ ★★★
    this.pendingNewGame = null; // ★★★ ДОБАВЛЕНО ДЛЯ НОВОЙ ЛОГИКИ ИГРЫ ★★★

    // ★★★ ДОБАВЛЕНА ПЕРЕМЕННАЯ ДЛЯ ИСТОРИИ ЧАТА ★★★
    this.chatHistory = [];
  }

  initializePieces() {
    const pieces = [];

    // Черные шашки (верхняя часть)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 !== 0) {
          pieces.push({ row, col, color: "black", isKing: false });
        }
      }
    }

    // Белые шашки (нижняя часть)
    for (let row = 5; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 !== 0) {
          pieces.push({ row, col, color: "white", isKing: false });
        }
      }
    }

    return pieces;
  }

  addPlayer(ws, username) {
    if (this.players.length < 2) {
      // ★★★ ПЕРВЫЙ ИГРОК - БЕЛЫЕ СНИЗУ, ВТОРОЙ - ЧЕРНЫЕ СНИЗУ ★★★
      let color, playsFromBottom;

      if (this.players.length === 0) {
        // Первый игрок - белые снизу
        color = "white";
        playsFromBottom = true;
      } else {
        // Второй игрок - черные снизу (перевернутая доска)
        color = "black";
        playsFromBottom = false; // ★★★ ВТОРОЙ ИГРОК ИГРАЕТ СВЕРХУ ★★★
      }

      const player = { ws, color, username };
      this.players.push(player);

      // ★★★ ОТПРАВЛЯЕМ ИНФОРМАЦИЮ О РАСПОЛОЖЕНИИ ★★★
      ws.send(
        JSON.stringify({
          type: "playerAssigned",
          color: color,
          playsFromBottom: playsFromBottom, // ★★★ ПЕРЕДАЕМ ИНФОРМАЦИЮ О ПОЗИЦИИ ★★★
        })
      );

      console.log(
        `Player ${username} joined as ${color}. Plays from bottom: ${playsFromBottom}. Total players: ${this.players.length}`
      );

      // ★★★ ОТПРАВЛЯЕМ ИСТОРИЮ ЧАТА НОВОМУ ИГРОКУ ★★★
      this.sendChatHistory(ws);

      // Отправляем информацию об игроках
      this.broadcastPlayersInfo();

      // ★★★ ДОБАВЛЯЕМ ПРИВЕТСТВЕННОЕ СООБЩЕНИЕ В ЧАТ ★★★
      this.broadcast(
        JSON.stringify({
          type: "chatMessage",
          player: "system",
          message: `👋 Игрок ${username} присоединился к игре`,
          isSmiley: false,
        })
      );

      if (this.players.length === 2) {
        this.startGame();
      }

      return color;
    }
    return null;
  }

  startGame() {
    this.gameState = "playing";
    this.currentPlayer = "white";
    this.drawOffer = null;
    this.pendingRestart = null;
    this.pendingNewGame = null;
    this.continueCapture = null;
    console.log("Game started! White moves first.");

    // ★★★ ДОБАВЛЕНО: Отправляем сообщение о готовности игры ★★★
    this.broadcast(
      JSON.stringify({
        type: "gameReady",
        message: "Оба игрока подключены, игра начинается!",
      })
    );

    // ★★★ ДОБАВЛЯЕМ СООБЩЕНИЕ В ЧАТ ★★★
    this.broadcast(
      JSON.stringify({
        type: "chatMessage",
        player: "system",
        message: "🎮 Игра началась! Удачи!",
        isSmiley: false,
      })
    );

    this.broadcastGameState();
  }

  removePlayer(ws) {
    const playerIndex = this.players.findIndex((player) => player.ws === ws);
    if (playerIndex !== -1) {
      const playerColor = this.players[playerIndex].color;
      const playerName = this.players[playerIndex].username;
      this.players.splice(playerIndex, 1);
      console.log(
        `Player ${playerName} (${playerColor}) disconnected. Remaining players: ${this.players.length}`
      );

      // ★★★ УВЕДОМЛЯЕМ ОСТАВШЕГОСЯ ИГРОКА ОБ ОТКЛЮЧЕНИИ ★★★
      if (this.players.length > 0) {
        this.players[0].ws.send(
          JSON.stringify({
            type: "playerDisconnected",
            message: "Противник отключился. Ожидание переподключения...",
          })
        );

        // ★★★ ДОБАВЛЯЕМ СООБЩЕНИЕ В ЧАТ ★★★
        this.broadcast(
          JSON.stringify({
            type: "chatMessage",
            player: "system",
            message: `🚪 Игрок ${playerName} покинул игру`,
            isSmiley: false,
          })
        );
      }

      if (this.gameState === "playing") {
        this.gameState = "finished";
        this.winner = this.players[0] ? this.players[0].color : null;
        this.broadcastGameOver();
      }
    }
  }

  // ★★★ ДОБАВЛЕН МЕТОД ДЛЯ ОБРАБОТКИ СООБЩЕНИЙ ЧАТА ★★★
  handleChatMessage(ws, messageData) {
    console.log("🔍 handleChatMessage called with:", messageData);

    const player = this.players.find((p) => p.ws === ws);
    if (!player) {
      console.log("❌ Player not found for chat message");
      return;
    }

    // ★★★ ДОБАВЬТЕ ЭТУ ПРОВЕРКУ ★★★
    if (!messageData.message || messageData.message.trim() === "") {
      console.log("❌ Empty message received");
      return;
    }

    // Сохраняем сообщение в истории (ограничиваем размер)
    this.chatHistory.push({
      player: player.username,
      message: messageData.message,
      isSmiley: messageData.isSmiley || false,
      timestamp: new Date().toISOString(),
    });

    // Ограничиваем историю последними 50 сообщениями
    if (this.chatHistory.length > 50) {
      this.chatHistory = this.chatHistory.slice(-50);
    }

    // Рассылаем сообщение всем игрокам
    const chatMessage = {
      type: "chatMessage",
      player: player.username,
      message: messageData.message,
      isSmiley: messageData.isSmiley || false,
    };

    console.log("📤 Broadcasting chat message:", chatMessage);
    this.broadcast(JSON.stringify(chatMessage));
    console.log("✅ Chat message broadcasted to all players");
  }

  // ★★★ ДОБАВЛЕН МЕТОД ДЛЯ ОТПРАВКИ ИСТОРИИ ЧАТА НОВОМУ ИГРОКУ ★★★
  sendChatHistory(ws) {
    if (this.chatHistory.length > 0) {
      ws.send(
        JSON.stringify({
          type: "chatHistory",
          messages: this.chatHistory.slice(-20), // Последние 20 сообщений
        })
      );
    }
  }

  // ★★★ ОБНОВЛЕННЫЙ МЕТОД ДЛЯ НОВОЙ ИГРЫ ★★★
  handleNewGameRequest(ws, fromUsername) {
    const player = this.players.find((p) => p.ws === ws);
    if (!player) return;

    console.log(`New game requested by ${player.username} (${player.color})`);

    // Если игрок только один, просто перезапускаем игру
    if (this.players.length === 1) {
      this.resetGame();
      return;
    }

    // Отправляем предложение второму игроку
    const opponent = this.players.find((p) => p.ws !== ws);
    if (opponent) {
      opponent.ws.send(
        JSON.stringify({
          type: "newGameRequest",
          from: fromUsername,
        })
      );
    }

    // Сохраняем информацию о запросе новой игры
    this.pendingNewGame = {
      requestedBy: player.color,
      requestedByUsername: fromUsername,
    };

    console.log(
      `New game request sent to other player. Waiting for response...`
    );
  }

  // ★★★ НОВЫЙ МЕТОД ДЛЯ ОБРАБОТКИ ОТВЕТА НА ЗАПРОС НОВОЙ ИГРЫ ★★★
  handleNewGameResponse(ws, accepted) {
    const player = this.players.find((p) => p.ws === ws);
    if (!player || !this.pendingNewGame) return;

    console.log(
      `New game response from ${player.username} (${player.color}): ${
        accepted ? "accepted" : "rejected"
      }`
    );

    // Отправляем ответ инициатору
    const initiator = this.players.find(
      (p) => p.color === this.pendingNewGame.requestedBy
    );
    if (initiator) {
      initiator.ws.send(
        JSON.stringify({
          type: accepted ? "newGameAccepted" : "newGameRejected",
        })
      );
    }

    if (accepted) {
      // Оба игрока согласились - начинаем новую игру
      console.log("Both players agreed to new game. Starting...");
      this.restartGame();
    } else {
      // Игрок отклонил предложение
      console.log("New game request was rejected");
      this.pendingNewGame = null;
    }
  }

  // ★★★ СТАРЫЙ МЕТОД (ОСТАВЛЯЕМ ДЛЯ СОВМЕСТИМОСТИ) ★★★
  handleNewGame(ws) {
    const player = this.players.find((p) => p.ws === ws);
    if (!player) return;

    console.log(
      `Legacy new game requested by ${player.username} (${player.color})`
    );

    // Если игрок только один, просто перезапускаем игру
    if (this.players.length === 1) {
      this.resetGame();
      return;
    }

    // Отправляем предложение второму игроку
    this.players.forEach((p) => {
      if (p.ws !== ws) {
        p.ws.send(
          JSON.stringify({
            type: "gameRestartRequest",
            requestedBy: player.username,
            requestedByColor: player.color,
          })
        );
      }
    });

    // Сохраняем информацию о запросе перезапуска
    this.pendingRestart = {
      requestedBy: player.color,
      requestedByUsername: player.username,
      confirmed: new Set([player.color]),
    };

    console.log(
      `Restart request sent to other player. Waiting for confirmation...`
    );
  }

  handleRestartConfirm(ws) {
    const player = this.players.find((p) => p.ws === ws);
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
    this.currentPlayer = "white";
    this.gameState = "playing";
    this.winner = null;
    this.drawOffer = null;
    this.pendingRestart = null;
    this.pendingNewGame = null;
    this.continueCapture = null;

    // ★★★ НЕ ОЧИЩАЕМ ИСТОРИЮ ЧАТА ПРИ ПЕРЕЗАПУСКЕ ★★★
    // this.chatHistory = [];

    this.broadcastGameState();
    this.broadcastPlayersInfo();

    // ★★★ ВАЖНО: Отправляем gameReady при перезапуске ★★★
    this.broadcast(
      JSON.stringify({
        type: "gameReady",
        message: "Новая игра началась!",
      })
    );

    this.broadcast(
      JSON.stringify({
        type: "gameRestarted",
        message: "Новая игра началась!",
      })
    );

    // ★★★ ДОБАВЛЯЕМ СИСТЕМНОЕ СООБЩЕНИЕ В ЧАТ ★★★
    this.broadcast(
      JSON.stringify({
        type: "chatMessage",
        player: "system",
        message: "🎮 Новая игра началась! Удачи!",
        isSmiley: false,
      })
    );

    console.log("New game started successfully");
  }

  resetGame() {
    console.log("Resetting game to initial state...");

    // Сбрасываем состояние игры
    this.pieces = this.initializePieces();
    this.currentPlayer = "white";
    this.gameState = "playing";
    this.winner = null;
    this.drawOffer = null;
    this.pendingRestart = null;
    this.pendingNewGame = null; // ★★★ СБРОС ЗАПРОСА НОВОЙ ИГРЫ ★★★
    this.continueCapture = null; // ★★★ СБРОС МНОЖЕСТВЕННОГО ВЗЯТИЯ ★★★

    console.log("Game reset successfully");
    this.broadcastGameState();
  }

  // ★★★ ДОБАВЛЕН МЕТОД ДЛЯ ОБРАБОТКИ СДАЧИ ★★★
  handleSurrender(ws) {
    const player = this.players.find((p) => p.ws === ws);
    if (!player || this.gameState !== "playing") return;

    console.log(`Player ${player.username} (${player.color}) surrendered`);

    // Определяем победителя (противник)
    const winner = player.color === "white" ? "black" : "white";

    // Завершаем игру с победой противника
    this.gameState = "finished";
    this.winner = winner;
    this.continueCapture = null;

    // Отправляем уведомление обоим игрокам
    this.broadcast(
      JSON.stringify({
        type: "gameOver",
        winner: winner,
        result: "surrender",
        surrenderedBy: player.username,
        surrenderedByColor: player.color,
      })
    );

    console.log(`Game over by surrender! Winner: ${winner}`);
  }

  handleMove(moveData, ws) {
    const player = this.players.find((p) => p.ws === ws);
    if (!player) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Игрок не найден",
        })
      );
      return;
    }

    // ★★★ ПРОВЕРКА ДЛЯ МНОЖЕСТВЕННОГО ВЗЯТИЯ ★★★
    if (this.continueCapture && this.continueCapture.player === player.color) {
      // Игрок продолжает взятие - проверяем, что ход идет от правильной позиции
      if (
        moveData.fromRow !== this.continueCapture.position.row ||
        moveData.fromCol !== this.continueCapture.position.col
      ) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Продолжайте взятие с текущей позиции",
          })
        );
        return;
      }
    } else if (player.color !== this.currentPlayer) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Сейчас не ваш ход",
        })
      );
      return;
    }

    const validation = this.validateMove(moveData);
    if (validation.valid) {
      this.executeMove(moveData, validation);
      this.checkForKing(moveData.toRow, moveData.toCol);

      // Сбрасываем предложение ничьи после хода
      this.drawOffer = null;

      // ★★★ УЛУЧШЕННАЯ ПРОВЕРКА ПРОДОЛЖЕНИЯ ВЗЯТИЯ ★★★
      if (validation.capturedPiece) {
        const canContinue = this.canContinueCapture(
          moveData.toRow,
          moveData.toCol
        );

        if (canContinue) {
          console.log(`Player ${player.color} can continue capturing`);
          // Сохраняем информацию о продолжении взятия
          this.continueCapture = {
            player: player.color,
            position: { row: moveData.toRow, col: moveData.toCol },
          };

          this.broadcastGameState();

          // Уведомляем клиента о возможности продолжения взятия
          ws.send(
            JSON.stringify({
              type: "canContinueCapture",
              position: { row: moveData.toRow, col: moveData.toCol },
            })
          );
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

      // ★★★ ОТПРАВЛЯЕМ ИНФОРМАЦИЮ О ВЫПОЛНЕННОМ ХОДЕ КАЖДОМУ ИГРОКУ ОТДЕЛЬНО ★★★
      this.players.forEach((p) => {
        const isViewerFlipped = p.color === "black"; // Для черных игроков доска перевернута

        // ★★★ ПРОВЕРКА КООРДИНАТ ★★★
        const viewerFromRow = isViewerFlipped
          ? 7 - moveData.fromRow
          : moveData.fromRow;
        const viewerFromCol = isViewerFlipped
          ? 7 - moveData.fromCol
          : moveData.fromCol;
        const viewerToRow = isViewerFlipped
          ? 7 - moveData.toRow
          : moveData.toRow;
        const viewerToCol = isViewerFlipped
          ? 7 - moveData.toCol
          : moveData.toCol;

        // ★★★ ПРОВЕРКА НА ВАЛИДНОСТЬ КООРДИНАТ ★★★
        if (
          viewerFromRow < 0 ||
          viewerFromRow > 7 ||
          viewerToRow < 0 ||
          viewerToRow > 7 ||
          viewerFromCol < 0 ||
          viewerFromCol > 7 ||
          viewerToCol < 0 ||
          viewerToCol > 7
        ) {
          console.log(
            `❌ Invalid coordinates for ${p.color}: from (${viewerFromRow},${viewerFromCol}) to (${viewerToRow},${viewerToCol})`
          );
          return; // Пропускаем этого игрока
        }

        p.ws.send(
          JSON.stringify({
            type: "moveMade",
            data: {
              fromRow: moveData.fromRow,
              fromCol: moveData.fromCol,
              toRow: moveData.toRow,
              toCol: moveData.toCol,
              player: player.color,
              currentPlayer: this.currentPlayer,
              username: player.username,
              isCapture: !!validation.capturedPiece,
              canContinue:
                !!validation.capturedPiece &&
                this.canContinueCapture(moveData.toRow, moveData.toCol),
              // ★★★ КОРРЕКТНЫЕ КООРДИНАТЫ ДЛЯ КАЖДОГО ИГРОКА ★★★
              viewerFromRow: viewerFromRow,
              viewerFromCol: viewerFromCol,
              viewerToRow: viewerToRow,
              viewerToCol: viewerToCol,
              isViewerFlipped: isViewerFlipped,
            },
          })
        );
      });

      ws.send(
        JSON.stringify({
          type: "moveResult",
          valid: true,
          gameState: this.getGameState(),
          canContinue:
            !!validation.capturedPiece &&
            this.canContinueCapture(moveData.toRow, moveData.toCol),
        })
      );
    } else {
      ws.send(
        JSON.stringify({
          type: "moveResult",
          valid: false,
          message: validation.message,
        })
      );
    }
  }

  validateMove(moveData) {
    const { fromRow, fromCol, toRow, toCol } = moveData;

    // Проверка границ доски
    if (
      !this.isValidPosition(fromRow, fromCol) ||
      !this.isValidPosition(toRow, toCol)
    ) {
      return { valid: false, message: "Неверные координаты" };
    }

    // Проверка существования шашки
    const piece = this.getPiece(fromRow, fromCol);
    if (!piece) {
      return { valid: false, message: "Шашка не найдена" };
    }

    if (piece.color !== this.currentPlayer) {
      return { valid: false, message: "Это не ваша шашка" };
    }

    // Проверка целевой клетки
    if (this.getPiece(toRow, toCol)) {
      return { valid: false, message: "Целевая клетка занята" };
    }

    // Проверка хода по диагонали
    if (Math.abs(toRow - fromRow) !== Math.abs(toCol - fromCol)) {
      return { valid: false, message: "Ход должен быть по диагонали" };
    }

    const rowDiff = toRow - fromRow;

    // ★★★ УЛУЧШЕННАЯ ПРОВЕРКА ОБЯЗАТЕЛЬНЫХ ВЗЯТИЙ ★★★
    const forcedCaptures = this.getForcedCaptures(this.currentPlayer);
    const isCaptureMove = Math.abs(rowDiff) >= 2;

    if (forcedCaptures.length > 0 && !isCaptureMove) {
      return { valid: false, message: "Обязательно брать шашку!" };
    }

    // Проверка обязательных взятий
    if (forcedCaptures.length > 0) {
      if (!isCaptureMove) {
        return { valid: false, message: "Обязательно брать шашку!" };
      }

      // Проверка взятия для дамки и простой шашки
      if (piece.isKing) {
        const validation = this.validateKingCapture(
          fromRow,
          fromCol,
          toRow,
          toCol,
          piece
        );
        if (!validation.valid) {
          return { valid: false, message: validation.message };
        }
        return validation;
      } else {
        // ★★★ УЛУЧШЕННАЯ ПРОВЕРКА ВЗЯТИЯ ДЛЯ ПРОСТОЙ ШАШКИ ★★★
        const rowStep = toRow > fromRow ? 1 : -1;
        const colStep = toCol > fromCol ? 1 : -1;
        let currentRow = fromRow + rowStep;
        let currentCol = fromCol + colStep;
        let capturedPiece = null;

        while (currentRow !== toRow || currentCol !== toCol) {
          const targetPiece = this.getPiece(currentRow, currentCol);

          if (targetPiece) {
            if (targetPiece.color !== piece.color) {
              if (capturedPiece) {
                // Уже нашли одну шашку - множественное взятие
                capturedPiece = { row: currentRow, col: currentCol };
                break;
              }
              capturedPiece = { row: currentRow, col: currentCol };
            } else {
              // Своя шашка на пути
              return { valid: false, message: "На пути своя шашка" };
            }
          }

          currentRow += rowStep;
          currentCol += colStep;
        }

        if (capturedPiece) {
          return {
            valid: true,
            capturedPiece: capturedPiece,
          };
        } else {
          return { valid: false, message: "Неверное взятие" };
        }
      }
    }

    // Проверка обычного хода для простой шашки
    if (!piece.isKing) {
      const direction = piece.color === "white" ? -1 : 1;
      if (Math.abs(rowDiff) !== 1) {
        return { valid: false, message: "Простая шашка ходит на одну клетку" };
      }
      if (rowDiff * direction < 0) {
        return { valid: false, message: "Простая шашка не может ходить назад" };
      }
    }

    // Для дамки проверяем свободный путь
    if (piece.isKing && !this.isPathClear(fromRow, fromCol, toRow, toCol)) {
      return { valid: false, message: "Путь для дамки занят" };
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
            return {
              valid: false,
              message: "Можно брать только одну шашку за ход",
            };
          }
          capturedPiece = { row: currentRow, col: currentCol };
          captureCount++;
        } else {
          // Своя шашка на пути
          return { valid: false, message: "На пути своя шашка" };
        }
      }

      currentRow += rowStep;
      currentCol += colStep;
    }

    if (captureCount === 1) {
      return {
        valid: true,
        capturedPiece: capturedPiece,
      };
    } else {
      return { valid: false, message: "Дамка должна брать ровно одну шашку" };
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
      const capturedPiece = this.getPiece(
        validation.capturedPiece.row,
        validation.capturedPiece.col
      );

      // ★★★ ОТПРАВЛЯЕМ ИНФОРМАЦИЮ О ВЗЯТИИ ★★★
      if (capturedPiece) {
        this.broadcast(
          JSON.stringify({
            type: "pieceCaptured",
            color: capturedPiece.color,
            isKing: capturedPiece.isKing,
          })
        );
      }

      this.removePiece(
        validation.capturedPiece.row,
        validation.capturedPiece.col
      );
    }
  }

  checkForKing(row, col) {
    const piece = this.getPiece(row, col);
    if (!piece.isKing) {
      if (
        (piece.color === "white" && row === 0) ||
        (piece.color === "black" && row === 7)
      ) {
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
    this.pieces.forEach((piece) => {
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
      { rowDir: -1, colDir: 1 }, // вверх-вправо
      { rowDir: 1, colDir: -1 }, // вниз-влево
      { rowDir: 1, colDir: 1 }, // вниз-вправо
    ];

    directions.forEach(({ rowDir, colDir }) => {
      if (piece.isKing) {
        // Логика для дамки (оставить как есть)
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
                captureCol: captureCol,
              });
            } else {
              break; // Клетка занята
            }
            landRow += rowDir;
            landCol += colDir;
          }
        }
      } else {
        // ★★★ ИСПРАВЛЕННАЯ ЛОГИКА ДЛЯ ПРОСТЫХ ШАШЕК ★★★
        // УБИРАЕМ ВТОРОЙ ЦИКЛ И ДУБЛИРОВАНИЕ directions
        const captureRow = piece.row + rowDir;
        const captureCol = piece.col + colDir;
        const landRow = piece.row + 2 * rowDir; // ТОЛЬКО +2 клетки
        const landCol = piece.col + 2 * colDir;

        if (
          this.isValidPosition(captureRow, captureCol) &&
          this.isValidPosition(landRow, landCol)
        ) {
          const capturedPiece = this.getPiece(captureRow, captureCol);
          const landingCell = this.getPiece(landRow, landCol);

          if (
            capturedPiece &&
            capturedPiece.color !== piece.color &&
            !landingCell
          ) {
            captures.push({
              fromRow: piece.row,
              fromCol: piece.col,
              toRow: landRow,
              toCol: landCol,
              captureRow: captureRow,
              captureCol: captureCol,
            });
          }
        }
      }
    });

    return captures;
  }

  getPiece(row, col) {
    return this.pieces.find((p) => p.row === row && p.col === col);
  }

  removePiece(row, col) {
    const index = this.pieces.findIndex((p) => p.row === row && p.col === col);
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
    this.currentPlayer = this.currentPlayer === "white" ? "black" : "white";
    console.log(`Switched to ${this.currentPlayer}'s turn`);
  }

  checkGameOver() {
    const whitePieces = this.pieces.filter((p) => p.color === "white");
    const blackPieces = this.pieces.filter((p) => p.color === "black");

    if (whitePieces.length === 0) {
      this.endGame("black");
    } else if (blackPieces.length === 0) {
      this.endGame("white");
    } else if (!this.canPlayerMove(this.currentPlayer)) {
      this.endGame(this.currentPlayer === "white" ? "black" : "white");
    }
  }

  canPlayerMove(color) {
    // ★★★ УЧИТЫВАЕМ МНОЖЕСТВЕННОЕ ВЗЯТИЕ ★★★
    if (this.continueCapture && this.continueCapture.player === color) {
      return true; // Игрок может продолжать взятие
    }

    return this.pieces.some((piece) => {
      if (piece.color === color) {
        const moves = this.getPossibleMoves(piece);
        return moves.length > 0;
      }
      return false;
    });
  }

  getPossibleMoves(piece) {
    // ★★★ УЧИТЫВАЕМ ОБЯЗАТЕЛЬНЫЕ ВЗЯТИЯ ★★★
    const forcedCaptures = this.getForcedCaptures(piece.color);
    if (forcedCaptures.length > 0) {
      // Возвращаем только взятия для этой шашки
      return forcedCaptures.filter(
        (capture) =>
          capture.fromRow === piece.row && capture.fromCol === piece.col
      );
    }

    // Затем обычные ходы
    const moves = [];
    const directions = piece.isKing
      ? [-1, 1]
      : [piece.color === "white" ? -1 : 1];

    directions.forEach((rowDir) => {
      [-1, 1].forEach((colDir) => {
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
                toCol: currentCol,
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

          if (
            this.isValidPosition(newRow, newCol) &&
            !this.getPiece(newRow, newCol)
          ) {
            moves.push({
              fromRow: piece.row,
              fromCol: piece.col,
              toRow: newRow,
              toCol: newCol,
            });
          }
        }
      });
    });

    return moves;
  }

  endGame(winner) {
    this.gameState = "finished";
    this.winner = winner;
    this.continueCapture = null; // ★★★ СБРОС МНОЖЕСТВЕННОГО ВЗЯТИЯ ★★★
    console.log(`Game over! Winner: ${winner}`);

    this.broadcast(
      JSON.stringify({
        type: "gameOver",
        winner: winner,
        result: winner ? "win" : "draw",
      })
    );
  }

  handleDrawOffer(ws, fromUsername) {
    const player = this.players.find((p) => p.ws === ws);
    if (!player) return;

    this.drawOffer = { from: player.color, username: fromUsername };

    // Отправляем предложение ничьи другому игроку
    const opponent = this.players.find((p) => p.color !== player.color);
    if (opponent) {
      opponent.ws.send(
        JSON.stringify({
          type: "drawOfferReceived",
          from: fromUsername,
        })
      );
    }
  }

  handleDrawResponse(ws, accepted) {
    const player = this.players.find((p) => p.ws === ws);
    if (!player || !this.drawOffer) return;

    if (accepted) {
      // Оба игрока согласились на ничью
      this.endGame(null);
    } else {
      // Отказ от ничьи
      const opponent = this.players.find((p) => p.color !== player.color);
      if (opponent) {
        opponent.ws.send(
          JSON.stringify({
            type: "drawRejected",
            by: player.username,
          })
        );
      }
      this.drawOffer = null;
    }
  }

  broadcastGameState() {
    const gameState = {
      type: "gameState",
      data: this.getGameState(),
    };

    this.broadcast(JSON.stringify(gameState));
  }

  broadcastPlayersInfo() {
    const playersInfo = {
      type: "playersInfo",
      data: this.players.map((p) => ({
        username: p.username,
        color: p.color,
      })),
    };

    this.broadcast(JSON.stringify(playersInfo));
  }

  broadcast(message) {
    this.players.forEach((player) => {
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
      continueCapture: this.continueCapture, // ★★★ ДОБАВЛЕНО ДЛЯ КЛИЕНТА ★★★
    };
  }
}

let game = new CheckersGameServer();

wss.on("connection", (ws, req) => {
  console.log("New WebSocket connection");

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      console.log("Received message type:", data.type);

      switch (data.type) {
        case "join":
          game.addPlayer(ws, data.username);
          break;

        case "move":
          game.handleMove(data.data, ws);
          break;

        // ★★★ НОВЫЕ ОБРАБОТЧИКИ ДЛЯ НОВОЙ ЛОГИКИ ИГРЫ ★★★
        case "newGameRequest":
          console.log("Received new game request");
          game.handleNewGameRequest(ws, data.from);
          break;

        case "newGameResponse":
          console.log("Received new game response:", data.accepted);
          game.handleNewGameResponse(ws, data.accepted);
          break;

        // ★★★ СТАРЫЕ ОБРАБОТЧИКИ (ДЛЯ СОВМЕСТИМОСТИ) ★★★
        case "newGame":
          console.log("Received legacy new game request");
          game.handleNewGame(ws);
          break;

        case "confirmRestart":
          console.log("Received restart confirmation");
          game.handleRestartConfirm(ws);
          break;

        case "drawOffer":
          game.handleDrawOffer(ws, data.from);
          break;

        case "drawResponse":
          game.handleDrawResponse(ws, data.accepted);
          break;

        // ★★★ ДОБАВЛЕНА ОБРАБОТКА СДАЧИ ★★★
        case "surrender":
          console.log("Received surrender request");
          game.handleSurrender(ws);
          break;

        // ★★★ ДОБАВЛЕНА ОБРАБОТКА СООБЩЕНИЙ ЧАТА ★★★
        case "chatMessage":
          console.log("Received chat message");
          game.handleChatMessage(ws, data);
          break;

        case "ping":
          ws.send(JSON.stringify({ type: "pong" }));
          break;

        default:
          console.log("Unknown message type:", data.type);
      }
    } catch (error) {
      console.error("Error parsing message:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Invalid message format",
        })
      );
    }
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed");
    game.removePlayer(ws);
  });
});

// Обработка graceful shutdown
process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down gracefully");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});
