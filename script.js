// script.js - ИСПРАВЛЕННАЯ ВЕРСИЯ с работающими кнопками
class CheckersGame {
  constructor() {
    this.board = document.getElementById("board");
    this.status = document.getElementById("status");
    this.restartContainer = document.getElementById("restartContainer");
    this.restartButton = document.getElementById("restartButton");
    this.loginModal = document.getElementById("loginModal");
    this.usernameInput = document.getElementById("usernameInput");
    this.startGameButton = document.getElementById("startGameButton");

    // ★★★ ИСПРАВЛЕНИЕ: ПРАВИЛЬНЫЕ ССЫЛКИ НА ЭЛЕМЕНТЫ ★★★
    this.drawOfferButton = document.getElementById("drawOfferButton");
    this.drawOfferModal = document.getElementById("drawOfferModal");
    this.drawOfferText = document.getElementById("drawOfferText");

    this.nicknameModal = document.getElementById("nicknameModal");
    this.nicknameInput = document.getElementById("nicknameInput");

    this.restartModal = document.getElementById("restartModal");
    this.restartMessage = document.getElementById("restartMessage");

    this.currentPlayer = "white";
    this.selectedPiece = null;
    this.possibleMoves = [];
    this.playerColor = null;
    this.ws = null;
    this.currentArrow = null;
    this.arrowTimeout = null;
    this.username = "";
    this.opponentName = "";

    this.continueCapturePiece = null;

    this.setupLogin();
    this.initializeGame();
    this.setupRestartButton();
    this.setupGameControls();
    this.setupRestartModal();
    
    this.updatePlayersInfo();
  }

  initializeGame() {
    this.createBoard();
    this.updateStatus("Введите ваш ник для начала игры...");
  }

  createBoard() {
    const board = document.getElementById('board');
    if (!board) return;
    
    board.innerHTML = '';
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const cell = document.createElement('div');
            cell.className = `cell ${(row + col) % 2 === 0 ? 'white' : 'black'}`;
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            if ((row + col) % 2 !== 0) {
                cell.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleCellClick(row, col);
                });
            }
            
            board.appendChild(cell);
        }
    }
    
    this.initializePieces();
  }

  initializePieces() {
    console.log("Initializing pieces on board...");
    
    this.clearBoard();
    
    // Чёрные шашки (верхние 3 ряда)
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 8; col++) {
            if ((row + col) % 2 === 1) {
                this.placePiece(row, col, 'black');
            }
        }
    }
    
    // Белые шашки (нижние 3 ряда)
    for (let row = 5; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if ((row + col) % 2 === 1) {
                this.placePiece(row, col, 'white');
            }
        }
    }
    
    console.log("Pieces initialized successfully");
  }

  placePiece(row, col, color, isKing = false) {
    const cell = this.getCell(row, col);
    if (!cell) {
        console.warn(`Cell not found at row:${row}, col:${col}`);
        return;
    }

    const existingPiece = cell.querySelector('.piece');
    if (existingPiece) {
        existingPiece.remove();
    }

    const piece = document.createElement('div');
    piece.className = `piece ${color} ${isKing ? 'king' : ''}`;
    piece.dataset.color = color;
    piece.dataset.king = isKing;

    const img = document.createElement('img');
    let imageSrc;

    if (color === 'white') {
        imageSrc = isKing ? 'shabedam.png' : 'shabe.png';
    } else {
        imageSrc = isKing ? 'shachdam.png' : 'shach.png';
    }

    img.src = imageSrc;
    img.alt = isKing ? `${color} дамка` : `${color} шашка`;
    img.style.width = '80%';
    img.style.height = '80%';
    
    img.onerror = () => {
        console.error(`Failed to load image: ${imageSrc}`);
        piece.style.backgroundColor = color;
        piece.style.border = '2px solid #000';
        piece.style.borderRadius = '50%';
        piece.style.width = '40px';
        piece.style.height = '40px';
        piece.style.display = 'flex';
        piece.style.alignItems = 'center';
        piece.style.justifyContent = 'center';
        if (isKing) {
            piece.innerHTML = '♔';
            piece.style.color = 'gold';
            piece.style.fontWeight = 'bold';
        }
    };

    piece.appendChild(img);
    cell.appendChild(piece);
  }

  // ★★★ ИСПРАВЛЕНИЕ: УПРОЩЕННЫЙ СБРОС ИГРЫ ★★★
  resetGame() {
    console.log("Resetting game to initial state...");
    
    this.currentPlayer = 'white';
    this.selectedPiece = null;
    this.possibleMoves = [];
    this.playerColor = null;
    this.continueCapturePiece = null;
    
    this.removeMoveArrow();
    this.createBoard();
    this.updatePlayersInfo();
    this.updateStatus("Новая игра началась! Ожидание подключения...");
  }

  clearBoard() {
    document.querySelectorAll(".piece").forEach((piece) => piece.remove());
  }

  updatePlayersInfo() {
    const whitePlayer = document.getElementById('whitePlayer');
    const blackPlayer = document.getElementById('blackPlayer');
    
    if (!whitePlayer || !blackPlayer) return;
    
    whitePlayer.classList.remove('active');
    blackPlayer.classList.remove('active');
    
    const whiteNickname = document.getElementById('whiteNickname');
    const blackNickname = document.getElementById('blackNickname');
    
    if (whiteNickname) {
        whiteNickname.textContent = this.playerColor === 'white' ? this.username : (this.opponentName || 'Ожидание...');
    }
    
    if (blackNickname) {
        blackNickname.textContent = this.playerColor === 'black' ? this.username : (this.opponentName || 'Ожидание...');
    }
    
    if (this.currentPlayer === 'white') {
        whitePlayer.classList.add('active');
    } else {
        blackPlayer.classList.add('active');
    }
  }

  setupLogin() {
    this.loginModal.style.display = "flex";

    this.startGameButton.addEventListener("click", () => {
      this.startGameWithUsername();
    });

    this.usernameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.startGameWithUsername();
      }
    });

    this.usernameInput.focus();
  }

  setupGameControls() {
    // ★★★ ИСПРАВЛЕНИЕ: ПРАВИЛЬНАЯ ПРИВЯЗКА КНОПКИ "НИЧЬЯ?" ★★★
    if (this.drawOfferButton) {
      this.drawOfferButton.addEventListener("click", () => {
        this.offerDraw();
      });
    }
  }

  // ★★★ ИСПРАВЛЕНИЕ: ПРАВИЛЬНАЯ ФУНКЦИЯ НОВОЙ ИГРЫ ★★★
  startNewGame() {
    console.log("Starting new game...");
    this.hideGameOverModal();
    
    // ★★★ ОТПРАВЛЯЕМ ЗАПРОС НА СЕРВЕР ★★★
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
            type: 'newGame'
        }));
        this.updateStatus("Запрос на новую игру отправлен...");
    } else {
        // Если нет соединения, сбрасываем локально
        this.resetGame();
    }
  }

  setupRestartModal() {
    // Обработчики уже есть в HTML через onclick
  }

  showRestartModal(opponentName) {
    if (this.restartModal && this.restartMessage) {
      this.restartMessage.textContent = `${opponentName} предлагает начать новую игру. Согласны?`;
      this.restartModal.style.display = "flex";
      this.board.style.pointerEvents = "none";
    }
  }

  hideRestartModal() {
    if (this.restartModal) {
      this.restartModal.style.display = "none";
      this.board.style.pointerEvents = "auto";
    }
  }

  confirmRestartAction() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'confirmRestart'
      }));
      this.updateStatus("Согласие на новую игру отправлено...");
    }
    this.hideRestartModal();
  }

  declineRestartAction() {
    this.updateStatus("Вы отклонили предложение новой игры");
    this.hideRestartModal();
  }

  // ★★★ ИСПРАВЛЕНИЕ: ПРАВИЛЬНАЯ ФУНКЦИЯ ПРЕДЛОЖЕНИЯ НИЧЬИ ★★★
  offerDraw() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.updateStatus("Нет соединения с сервером");
      return;
    }

    console.log("Sending draw offer...");
    
    // ★★★ ПРАВИЛЬНЫЙ ФОРМАТ СООБЩЕНИЯ ★★★
    this.ws.send(
      JSON.stringify({
        type: "drawOffer"
      })
    );

    this.updateStatus("Предложение ничьи отправлено...");
  }

  showDrawOfferModal(opponentName) {
    if (this.drawOfferModal && this.drawOfferText) {
      this.drawOfferText.textContent = `${opponentName} предлагает ничью`;
      this.drawOfferModal.style.display = "flex";
      this.board.style.pointerEvents = "none";
    }
  }

  hideDrawOfferModal() {
    if (this.drawOfferModal) {
      this.drawOfferModal.style.display = "none";
      this.board.style.pointerEvents = "auto";
    }
  }

  // ★★★ ИСПРАВЛЕНИЕ: ПРАВИЛЬНЫЕ ФУНКЦИИ ОТВЕТА НА НИЧЬЮ ★★★
  acceptDrawOffer() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.updateStatus("Нет соединения с сервером");
      return;
    }

    console.log("Accepting draw offer...");
    
    this.ws.send(
      JSON.stringify({
        type: "drawResponse",
        accept: true
      })
    );

    this.hideDrawOfferModal();
    this.updateStatus("Вы приняли предложение ничьи");
  }

  rejectDrawOffer() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.updateStatus("Нет соединения с сервером");
      return;
    }

    console.log("Rejecting draw offer...");
    
    this.ws.send(
      JSON.stringify({
        type: "drawResponse",
        accept: false
      })
    );

    this.hideDrawOfferModal();
    this.updateStatus("Вы отклонили предложение ничьи");
  }

  startGameWithUsername() {
    const username = this.usernameInput.value.trim();

    if (username.length < 2) {
      alert("Пожалуйста, введите ник длиной от 2 символов");
      this.usernameInput.focus();
      return;
    }

    if (username.length > 15) {
      alert("Ник не должен превышать 15 символов");
      this.usernameInput.focus();
      return;
    }

    this.username = username;
    this.loginModal.style.display = "none";

    this.updatePlayersInfo();
    this.updateStatus(`Добро пожаловать, ${username}! Подключение к серверу...`);

    this.setupWebSocket();
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

    if (this.continueCapturePiece) {
      const continueRow = this.continueCapturePiece.row;
      const continueCol = this.continueCapturePiece.col;
      
      if (continueRow === row && continueCol === col) {
        this.continueCapturePiece = null;
        this.clearSelection();
        this.updateStatus("Выберите направление для продолжения взятия");
        return;
      }
      
      this.makeMove(continueRow, continueCol, row, col);
      this.clearSelection();
      return;
    }

    if (this.selectedPiece) {
      this.makeMove(this.selectedPiece.row, this.selectedPiece.col, row, col);
      this.clearSelection();
    }
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
      this.ws.send(
        JSON.stringify({
          type: "join",
          username: this.username,
        })
      );
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
      this.updateStatus("Соединение потеряно. Переподключение через 3 секунды...");
      setTimeout(() => {
        this.setupWebSocket();
      }, 3000);
    };

    this.ws.onerror = (error) => {
      console.error("💥 WebSocket error:", error);
      this.updateStatus("Ошибка соединения с сервером");
    };
  }

  setupRestartButton() {
    this.restartButton.addEventListener("click", () => {
      this.restartGame();
    });
  }

  restartGame() {
    console.log("Restarting game...");

    this.removeMoveArrow();
    this.restartContainer.style.display = "none";
    this.board.style.display = "grid";
    this.status.style.display = "block";

    this.selectedPiece = null;
    this.possibleMoves = [];
    this.playerColor = null;
    this.currentPlayer = "white";
    this.continueCapturePiece = null;

    this.updateStatus("Перезапуск игры...");
    this.clearBoard();

    if (this.ws) {
      this.ws.close();
    }

    setTimeout(() => {
      this.setupWebSocket();
    }, 1000);
  }

  createMoveArrow(fromRow, fromCol, toRow, toCol) {
    this.removeMoveArrow();

    const fromCell = this.getCell(fromRow, fromCol);
    const toCell = this.getCell(toRow, toCol);

    if (!fromCell || !toCell) return;

    const fromRect = fromCell.getBoundingClientRect();
    const toRect = toCell.getBoundingClientRect();
    const boardRect = this.board.getBoundingClientRect();

    const fromX = fromRect.left + fromRect.width / 2 - boardRect.left;
    const fromY = fromRect.top + fromRect.height / 2 - boardRect.top;
    const toX = toRect.left + toRect.width / 2 - boardRect.left;
    const toY = toRect.top + toRect.height / 2 - boardRect.top;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("move-arrow");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.style.position = "absolute";
    svg.style.top = "0";
    svg.style.left = "0";
    svg.style.pointerEvents = "none";

    const dx = toX - fromX;
    const dy = toY - fromY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

    const shortenBy = 25;
    const shortenedLength = length - shortenBy * 2;
    const shortenX = (dx / length) * shortenBy;
    const shortenY = (dy / length) * shortenBy;

    const adjustedFromX = fromX + shortenX;
    const adjustedFromY = fromY + shortenY;
    const adjustedToX = toX - shortenX;
    const adjustedToY = toY - shortenY;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.classList.add("arrow-line", "arrow-animation");
    line.setAttribute("x1", adjustedFromX);
    line.setAttribute("y1", adjustedFromY);
    line.setAttribute("x2", adjustedToX);
    line.setAttribute("y2", adjustedToY);

    const headLength = 15;
    const headAngle = 30;

    const head = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    head.classList.add("arrow-head");

    const angleRad = (angle * Math.PI) / 180;
    const x1 = adjustedToX - headLength * Math.cos(angleRad - (headAngle * Math.PI) / 180);
    const y1 = adjustedToY - headLength * Math.sin(angleRad - (headAngle * Math.PI) / 180);
    const x2 = adjustedToX - headLength * Math.cos(angleRad + (headAngle * Math.PI) / 180);
    const y2 = adjustedToY - headLength * Math.sin(angleRad + (headAngle * Math.PI) / 180);

    head.setAttribute("points", `${adjustedToX},${adjustedToY} ${x1},${y1} ${x2},${y2}`);

    svg.appendChild(line);
    svg.appendChild(head);

    this.currentArrow = svg;
    this.board.appendChild(svg);

    if (this.arrowTimeout) {
      clearTimeout(this.arrowTimeout);
    }

    this.arrowTimeout = setTimeout(() => {
      this.removeMoveArrow();
    }, 3000);
  }

  removeMoveArrow() {
    if (this.arrowTimeout) {
      clearTimeout(this.arrowTimeout);
      this.arrowTimeout = null;
    }

    if (this.currentArrow) {
      this.currentArrow.remove();
      this.currentArrow = null;
    }
  }

  // ★★★ ИСПРАВЛЕНИЕ: ОБНОВЛЕННАЯ ОБРАБОТКА СООБЩЕНИЙ ★★★
  handleServerMessage(message) {
    console.log("Processing message type:", message.type);
    
    switch (message.type) {
      case "playerAssigned":
        this.playerColor = message.color;
        const colorText = this.playerColor === "white" ? "белые" : "чёрные";
        this.updateStatus(`Вы играете за ${colorText}. Ожидание второго игрока...`);
        this.updatePlayersInfo();
        break;

      case "gameState":
        this.updateGameState(message.data);
        break;

      case "moveResult":
        if (message.valid) {
          this.updateGameState(message.gameState);
          
          if (message.canContinueCapture) {
            this.continueCapturePiece = {
              row: message.continueFromRow,
              col: message.continueFromCol
            };
            this.updateStatus("Можете продолжить взятие! Выберите следующую шашку для взятия.");
          } else {
            this.continueCapturePiece = null;
          }
        } else {
          this.updateStatus(`❌ ${message.message}`);
        }
        break;

      case "moveMade":
        this.handleMoveMade(message.data);
        break;

      case "playersInfo":
        this.handlePlayersInfo(message.data);
        break;

      // ★★★ ИСПРАВЛЕНИЕ: ОБРАБОТКА ПРЕДЛОЖЕНИЯ НИЧЬИ ★★★
      case "drawOffer":
        this.showDrawOfferModal(message.nickname || message.from);
        break;

      case "drawRejected":
        this.updateStatus(`${message.by || 'Противник'} отклонил предложение ничьи`);
        break;

      // ★★★ ДОБАВЛЕНА ОБРАБОТКА ПРИНЯТИЯ НИЧЬИ ★★★
      case "drawAccepted":
        this.updateStatus("Ничья принята! Игра завершена.");
        this.handleGameOver({ winner: 'draw' });
        break;

      case "gameOver":
        // ★★★ ЗАДЕРЖКА 1 СЕКУНДА ★★★
        setTimeout(() => {
          this.handleGameOver(message);
        }, 1000);
        break;

      case "gameRestartRequest":
        this.showRestartModal(message.requestedBy);
        break;

      case "gameRestarted":
        this.resetGame();
        this.updateStatus("Новая игра началась!");
        break;

      case "restartRejected":
        this.updateStatus("Противник отклонил предложение новой игры");
        break;

      case "error":
        this.updateStatus(`⚠️ ${message.message}`);
        break;

      default:
        console.log("Unknown message type:", message.type);
    }
  }

  handleMoveMade(moveData) {
    console.log("Move made by:", moveData.player, moveData);

    setTimeout(() => {
      this.createMoveArrow(
        moveData.fromRow,
        moveData.fromCol,
        moveData.toRow,
        moveData.toCol
      );
    }, 100);

    if (moveData.currentPlayer) {
      this.currentPlayer = moveData.currentPlayer;
    }

    this.updatePlayersInfo();
    this.updateTurnStatus();
  }

  updateTurnStatus() {
    if (this.currentPlayer === this.playerColor) {
      this.updateStatus("✅ Ваш ход!");
    } else {
      this.updateStatus("⏳ Ход противника...");
    }
  }

  handlePlayersInfo(players) {
    console.log("Players info:", players);
    if (players.length === 2) {
      const opponent = players.find((p) => p.username !== this.username);
      if (opponent) {
        this.opponentName = opponent.username;
        console.log(`Playing against: ${this.opponentName} (${opponent.color})`);
        this.updatePlayersInfo();
      }
    }
  }

  updateGameState(gameState) {
    this.clearBoard();

    gameState.pieces.forEach((piece) => {
      this.placePiece(piece.row, piece.col, piece.color, piece.isKing);
    });

    this.currentPlayer = gameState.currentPlayer;
    this.updatePlayersInfo();
    this.updateTurnStatus();

    console.log("Game state updated. Current player:", this.currentPlayer);
  }

  getCell(row, col) {
    return document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  }

  highlightCell(row, col, className) {
    const cell = this.getCell(row, col);
    if (cell) {
      document.querySelectorAll(".cell").forEach((c) => {
        c.classList.remove("selected", "possible-move");
      });
      cell.classList.add(className);
    }
  }

  clearSelection() {
    this.selectedPiece = null;
    document.querySelectorAll(".cell").forEach((cell) => {
      cell.classList.remove("selected", "possible-move");
    });
  }

  // ★★★ ИСПРАВЛЕНИЕ: ЗАДЕРЖКА 1 СЕКУНДА ★★★
  handleGameOver(result) {
    setTimeout(() => {
        let winnerText;
        let gameOverMessage;
        
        if (result.winner === 'draw') {
            winnerText = "🤝 Ничья!";
            gameOverMessage = "Ничья!";
        } else if (result.winner) {
            const winnerName = result.winner === this.playerColor ? this.username : this.opponentName;
            const colorText = result.winner === "white" ? "белые" : "чёрные";
            winnerText = `🏆 Победил ${winnerName} (${colorText})`;
            gameOverMessage = `Победил ${winnerName} (${colorText})`;
        } else {
            winnerText = "🤝 Ничья!";
            gameOverMessage = "Ничья!";
        }

        this.updateStatus(`Игра окончена! ${winnerText}`);
        
        const gameOverMessageElement = document.getElementById('gameOverMessage');
        if (gameOverMessageElement) {
            gameOverMessageElement.textContent = gameOverMessage;
        }

        this.removeMoveArrow();
        this.continueCapturePiece = null;
        this.showGameOverModal();
    }, 1000);
  }

  showGameOverModal() {
    const modal = document.getElementById('gameOverModal');
    if (modal) {
      modal.style.display = 'flex';
    }
  }

  hideGameOverModal() {
    const modal = document.getElementById('gameOverModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  showRestartContainer() {
    this.board.style.display = "none";
    this.status.style.display = "none";
    this.restartContainer.style.display = "block";
  }

  updateStatus(message) {
    if (this.status) {
      let statusText = message;

      const isSystemMessage = message.includes("✅") || message.includes("⏳") || message.includes("❌") || message.includes("⚠️") || message.includes("Подключено") || message.includes("Ожидание") || message.includes("Добро пожаловать") || message.includes("Перезапуск") || message.includes("Вы играете") || message.includes("Сейчас не ваш ход") || message.includes("Ход отправляется") || message.includes("Соединение потеряно") || message.includes("Ошибка соединения") || message.includes("Выберите клетку") || message.includes("Предложение ничьи") || message.includes("отклонил предложение") || message.includes("Запрос на новую игру") || message.includes("Согласие на новую игру") || message.includes("отклонил предложение новой игры") || message.includes("Можете продолжить взятие");

      if (this.username && this.playerColor && !isSystemMessage) {
        const colorText = this.playerColor === "white" ? "белые" : "чёрные";
        const currentTurnColor = this.currentPlayer === "white" ? "белых" : "чёрных";
        statusText = `${this.username} (${colorText}) - Ход ${currentTurnColor}`;
      } else if (this.username && this.playerColor && isSystemMessage) {
        const colorText = this.playerColor === "white" ? "белые" : "чёрные";
        statusText = `${this.username} (${colorText}) - ${message}`;
      } else if (this.username) {
        statusText = `${this.username} - ${message}`;
      }

      this.status.textContent = statusText;
    }
    console.log("Status:", message, "Current player:", this.currentPlayer);
  }
}

// ★★★ ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ HTML ★★★
function startNewGame() {
  if (window.checkersGame) {
    window.checkersGame.startNewGame();
  }
}

function acceptDrawOffer() {
  if (window.checkersGame) {
    window.checkersGame.acceptDrawOffer();
  }
}

function rejectDrawOffer() {
  if (window.checkersGame) {
    window.checkersGame.rejectDrawOffer();
  }
}

function confirmRestart() {
  if (window.checkersGame) {
    window.checkersGame.confirmRestartAction();
  }
}

function declineRestart() {
  if (window.checkersGame) {
    window.checkersGame.declineRestartAction();
  }
}

// ★★★ ИСПРАВЛЕННОЕ СОЗДАНИЕ ЭКЗЕМПЛЯРА ИГРЫ ★★★
console.log("📝 script.js loaded, waiting for DOM...");

function initGame() {
  console.log("🎮 Initializing Checkers Game...");
  try {
    window.checkersGame = new CheckersGame();
    console.log("✅ CheckersGame initialized successfully");
    console.log("checkersGame object:", window.checkersGame);
  } catch (error) {
    console.error("❌ Error initializing CheckersGame:", error);
  }
}

// Несколько способов инициализации для надежности
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}

// Дублирующая инициализация на случай если DOM уже загружен
setTimeout(initGame, 1000);

