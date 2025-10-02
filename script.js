// script.js - ФИНАЛЬНАЯ ВЕРСИЯ для шашек
class CheckersGame {
  constructor() {
    this.board = document.getElementById("board");
    this.status = document.getElementById("status");
    this.currentPlayer = "white";
    this.selectedPiece = null;
    this.possibleMoves = [];
    this.playerColor = null;
    this.ws = null;

    this.initializeGame();
    this.setupWebSocket();
  }

  initializeGame() {
    this.createBoard();
    this.updateStatus("Подключение к серверу...");
  }

  createBoard() {
    this.board.innerHTML = "";
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const cell = document.createElement("div");
        cell.className = `cell ${(row + col) % 2 === 0 ? "white" : "black"}`;
        cell.dataset.row = row;
        cell.dataset.col = col;

        // Только черные клетки кликабельны
        if ((row + col) % 2 !== 0) {
          cell.addEventListener("click", () => this.handleCellClick(row, col));
        }

        this.board.appendChild(cell);
      }
    }
  }

  handleCellClick(row, col) {
    console.log("Cell clicked:", row, col);

    if (!this.playerColor) {
      this.updateStatus("Ожидание подключения...");
      return;
    }

    if (this.playerColor !== this.currentPlayer) {
      this.updateStatus("Сейчас не ваш ход!");
      return;
    }

    const cell = this.getCell(row, col);
    const piece = cell.querySelector(".piece");

    // Если уже выбрана шашка - пробуем сделать ход
    if (this.selectedPiece) {
      this.makeMove(this.selectedPiece.row, this.selectedPiece.col, row, col);
      this.clearSelection();
    }
    // Если кликнули на свою шашку - выбираем её
    else if (piece && piece.dataset.color === this.playerColor) {
      this.selectedPiece = { row, col };
      this.highlightCell(row, col, "selected");
      this.updateStatus("Выберите клетку для хода");
    }
  }

  makeMove(fromRow, fromCol, toRow, toCol) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.updateStatus("Нет соединения с сервером");
      return;
    }

    const moveData = {
      fromRow: fromRow,
      fromCol: fromCol,
      toRow: toRow,
      toCol: toCol,
    };

    console.log("Sending move:", moveData);
    this.ws.send(
      JSON.stringify({
        type: "move",
        data: moveData,
      })
    );

    this.updateStatus("Ход отправляется...");
  }

  setupWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}`;

    console.log("Connecting to WebSocket:", wsUrl);

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log("✅ WebSocket connected successfully");
      this.updateStatus("Подключено! Ожидание второго игрока...");
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("📨 Received message:", message);
        this.handleServerMessage(message);
      } catch (error) {
        console.error("❌ Error parsing message:", error);
      }
    };

    this.ws.onclose = (event) => {
      console.log("🔌 WebSocket disconnected:", event.code, event.reason);
      this.updateStatus(
        "Соединение потеряно. Переподключение через 3 секунды..."
      );
      setTimeout(() => {
        this.setupWebSocket();
      }, 3000);
    };

    this.ws.onerror = (error) => {
      console.error("💥 WebSocket error:", error);
      this.updateStatus("Ошибка соединения с сервером");
    };
  }

  handleServerMessage(message) {
    switch (message.type) {
      case "playerAssigned":
        this.playerColor = message.color;
        const colorText = message.color === "white" ? "белые" : "черные";
        this.updateStatus(
          `Вы играете за ${colorText}. Ожидание второго игрока...`
        );
        break;

      case "gameState":
        this.updateGameState(message.data);
        break;

      case "moveResult":
        if (message.valid) {
          this.updateGameState(message.gameState);
          const statusText =
            message.gameState.currentPlayer === this.playerColor
              ? "✅ Ваш ход!"
              : "⏳ Ход противника...";
          this.updateStatus(statusText);
        } else {
          this.updateStatus(`❌ ${message.message}`);
        }
        break;

      case "gameOver":
        const winnerText = message.winner
          ? `🏆 Победитель: ${message.winner === "white" ? "белые" : "черные"}`
          : "🤝 Ничья!";
        this.updateStatus(`Игра окончена! ${winnerText}`);

        setTimeout(() => {
          if (confirm("Игра завершена. Хотите сыграть еще?")) {
            location.reload();
          }
        }, 1500);
        break;

      case "error":
        this.updateStatus(`⚠️ ${message.message}`);
        break;

      default:
        console.log("Unknown message type:", message.type);
    }
  }

  updateGameState(gameState) {
    // Очищаем доску
    document.querySelectorAll(".piece").forEach((piece) => piece.remove());

    // Расставляем шашки согласно состоянию игры
    gameState.pieces.forEach((piece) => {
      this.placePiece(piece.row, piece.col, piece.color, piece.isKing);
    });

    // Обновляем текущего игрока
    this.currentPlayer = gameState.currentPlayer;

    console.log("Game state updated. Current player:", this.currentPlayer);
  }

  placePiece(row, col, color, isKing = false) {
    const cell = this.getCell(row, col);
    if (!cell) return;

    const piece = document.createElement("div");
    piece.className = `piece ${color} ${isKing ? "king" : ""}`;
    piece.dataset.color = color;
    piece.dataset.king = isKing;

    // Создаем изображение шашки
    const img = document.createElement("img");
    let imageSrc;

    if (color === "white") {
      imageSrc = isKing ? "shabedam.png" : "shabe.png";
    } else {
      imageSrc = isKing ? "shachdam.png" : "shach.png";
    }

    img.src = imageSrc;
    img.alt = isKing ? `${color} дамка` : `${color} шашка`;
    img.onerror = () => {
      console.error(`Failed to load image: ${imageSrc}`);
      // Запасной вариант - цветной круг
      piece.style.backgroundColor = color;
      piece.style.border = "2px solid #000";
      if (isKing) {
        piece.innerHTML = "♔";
        piece.style.color = "gold";
      }
    };

    piece.appendChild(img);
    cell.appendChild(piece);
  }

  getCell(row, col) {
    return document.querySelector(
      `.cell[data-row="${row}"][data-col="${col}"]`
    );
  }

  highlightCell(row, col, className) {
    const cell = this.getCell(row, col);
    if (cell) {
      // Сначала убираем все выделения
      document.querySelectorAll(".cell").forEach((c) => {
        c.classList.remove("selected", "possible-move");
      });
      // Затем добавляем новое
      cell.classList.add(className);
    }
  }

  clearSelection() {
    this.selectedPiece = null;
    document.querySelectorAll(".cell").forEach((cell) => {
      cell.classList.remove("selected", "possible-move");
    });
  }

  updateStatus(message) {
    if (this.status) {
      this.status.textContent = message;
    }
    console.log("Status:", message);
  }
}

// Запускаем игру когда страница полностью загружена
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Starting Checkers Game...");
  new CheckersGame();
});

// Добавляем обработчик для переподключения при видимости страницы
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    // Страница снова стала активной - проверяем соединение
    console.log("Page became visible, checking connection...");
  }
});
