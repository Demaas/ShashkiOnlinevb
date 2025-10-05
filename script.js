// script.js - ОБНОВЛЕННАЯ ВЕРСИЯ с исправлениями для кнопок, финального окна и фона модальных окон
class CheckersGame {
  constructor() {
    this.board = document.getElementById("board");
    this.status = document.getElementById("status");
    this.restartContainer = document.getElementById("restartContainer");
    this.restartButton = document.getElementById("restartButton");
    this.loginModal = document.getElementById("loginModal");
    this.usernameInput = document.getElementById("usernameInput");
    this.startGameButton = document.getElementById("startGameButton");

    // ★★★ ИЗМЕНЕНИЕ 1: УБИРАЕМ ССЫЛКИ НА УДАЛЕННЫЕ КНОПКИ ★★★
    this.drawOfferButton = document.getElementById("drawOfferButton");
    this.drawOfferModal = document.getElementById("drawOfferModal");
    this.acceptDraw = document.getElementById("acceptDraw");
    this.rejectDraw = document.getElementById("rejectDraw");
    this.drawOfferText = document.getElementById("drawOfferText");

    // ★★★ ИЗМЕНЕНИЕ 2: ДОБАВЛЯЕМ НОВОЕ МОДАЛЬНОЕ ОКНО ДЛЯ НОВОЙ ИГРЫ ★★★
    this.nicknameModal = document.getElementById("nicknameModal");
    this.nicknameInput = document.getElementById("nicknameInput");

    // Добавляем модальное окно для подтверждения перезапуска
    this.restartModal = document.getElementById("restartModal");
    this.restartMessage = document.getElementById("restartMessage");
    this.confirmRestart = document.getElementById("confirmRestart");
    this.declineRestart = document.getElementById("declineRestart");

    this.currentPlayer = "white";
    this.selectedPiece = null;
    this.possibleMoves = [];
    this.playerColor = null;
    this.ws = null;
    this.currentArrow = null;
    this.arrowTimeout = null;
    this.username = "";
    this.opponentName = "";

    // ★★★ ДОБАВЛЕНЫ НОВЫЕ ПЕРЕМЕННЫЕ ДЛЯ ИНФОРМАЦИИ ОБ ИГРОКАХ ★★★
    this.continueCapturePiece = null; // Для множественного взятия

    this.setupLogin();
    this.initializeGame();
    this.setupRestartButton();
    this.setupGameControls();
    this.setupRestartModal();
    
    // ★★★ ДОБАВЛЕН ВЫЗОВ ФУНКЦИИ ДЛЯ ОБНОВЛЕНИЯ ИНФОРМАЦИИ ОБ ИГРОКАХ ★★★
    this.updatePlayersInfo();
  }

  initializeGame() {
    this.createBoard();
    this.updateStatus("Введите ваш ник для начала игры...");
  }

  // ★★★ ОБНОВЛЕННЫЙ МЕТОД - ПРАВИЛЬНАЯ РАССТАНОВКА НА ЧЕРНЫХ КЛЕТКАХ ★★★
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
            
            // Добавляем обработчик клика только на черные клетки
            if ((row + col) % 2 !== 0) {
                cell.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleCellClick(row, col);
                });
            }
            
            board.appendChild(cell);
        }
    }
    
    // После создания доски - расставляем шашки
    this.initializePieces();
  }

  // ★★★ ИСПРАВЛЕННЫЙ МЕТОД - ПРАВИЛЬНАЯ РАССТАНОВКА ШАШЕК ★★★
  initializePieces() {
    console.log("Initializing pieces on board...");
    
    // Сначала очищаем все существующие шашки
    this.clearBoard();
    
    // ★★★ ПРАВИЛЬНАЯ РАССТАНОВКА - ТОЛЬКО НА ЧЕРНЫХ КЛЕТКАХ ★★★
    
    // Чёрные шашки (верхние 3 ряда)
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 8; col++) {
            if ((row + col) % 2 === 1) { // Только черные клетки
                this.placePiece(row, col, 'black');
            }
        }
    }
    
    // Белые шашки (нижние 3 ряда)
    for (let row = 5; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if ((row + col) % 2 === 1) { // Только черные клетки
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

    // Очищаем клетку перед размещением шашки
    const existingPiece = cell.querySelector('.piece');
    if (existingPiece) {
        existingPiece.remove();
    }

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
    img.style.width = '80%';
    img.style.height = '80%';
    
    img.onerror = () => {
        console.error(`Failed to load image: ${imageSrc}`);
        // Запасной вариант - цветной круг
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

  // ★★★ ОБНОВЛЕННЫЙ МЕТОД СБРОСА ИГРЫ ★★★
  resetGame() {
    console.log("Resetting game to initial state...");
    
    // Сбрасываем игровые переменные
    this.currentPlayer = 'white';
    this.selectedPiece = null;
    this.possibleMoves = [];
    this.playerColor = null;
    this.continueCapturePiece = null; // Сбрасываем множественное взятие
    
    // Удаляем стрелку
    this.removeMoveArrow();
    
    // Очищаем доску и пересоздаём с начальной расстановкой
    this.createBoard();
    
    // Обновляем информацию об игроках
    this.updatePlayersInfo();
    
    // Обновляем статус
    this.updateStatus("Новая игра началась! Ожидание подключения...");
    
    // Если WebSocket активен, отправляем запрос на новую игру
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
            type: 'newGame'
        }));
    }
  }

  clearBoard() {
    // Очищаем все шашки с доски
    document.querySelectorAll(".piece").forEach((piece) => piece.remove());
  }

  // ★★★ ДОБАВЛЕН МЕТОД ДЛЯ ОБНОВЛЕНИЯ ИНФОРМАЦИИ ОБ ИГРОКАХ ★★★
  updatePlayersInfo() {
    const whitePlayer = document.getElementById('whitePlayer');
    const blackPlayer = document.getElementById('blackPlayer');
    
    if (!whitePlayer || !blackPlayer) return;
    
    const whiteIndicator = whitePlayer.querySelector('.turn-indicator');
    const blackIndicator = blackPlayer.querySelector('.turn-indicator');
    
    // Сбрасываем индикаторы
    whitePlayer.classList.remove('active');
    blackPlayer.classList.remove('active');
    
    // Обновляем никнеймы
    const whiteNickname = document.getElementById('whiteNickname');
    const blackNickname = document.getElementById('blackNickname');
    
    if (whiteNickname) {
        whiteNickname.textContent = this.playerColor === 'white' ? this.username : (this.opponentName || 'Ожидание...');
    }
    
    if (blackNickname) {
        blackNickname.textContent = this.playerColor === 'black' ? this.username : (this.opponentName || 'Ожидание...');
    }
    
    // Активируем текущего игрока
    if (this.currentPlayer === 'white') {
        whitePlayer.classList.add('active');
    } else {
        blackPlayer.classList.add('active');
    }
  }

  setupLogin() {
    // Показываем модальное окно при загрузке
    this.loginModal.style.display = "flex";

    // Обработчик кнопки начала игры
    this.startGameButton.addEventListener("click", () => {
      this.startGameWithUsername();
    });

    // Обработчик нажатия Enter в поле ввода
    this.usernameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.startGameWithUsername();
      }
    });

    // Автофокус на поле ввода
    this.usernameInput.focus();
  }

  setupGameControls() {
    // ★★★ ИЗМЕНЕНИЕ 3: ОБРАБОТЧИК ДЛЯ КНОПКИ "НИЧЬЯ?" ★★★
    if (this.drawOfferButton) {
      this.drawOfferButton.addEventListener("click", () => {
        this.offerDraw();
      });
    }

    if (this.acceptDraw) {
      this.acceptDraw.addEventListener("click", () => {
        this.acceptDrawOffer();
      });
    }

    if (this.rejectDraw) {
      this.rejectDraw.addEventListener("click", () => {
        this.rejectDrawOffer();
      });
    }

    // ★★★ ИЗМЕНЕНИЕ 4: ОБРАБОТЧИК ДЛЯ КНОПКИ "НОВАЯ ИГРА" В ФИНАЛЬНОМ ОКНЕ ★★★
    const newGameBtn = document.querySelector('#gameOverModal button');
    if (newGameBtn) {
      newGameBtn.addEventListener('click', () => {
        this.startNewGame();
      });
    }

    // Закрытие модальных окон при клике вне их
    if (this.drawOfferModal) {
      this.drawOfferModal.addEventListener("click", (e) => {
        if (e.target === this.drawOfferModal) {
          // Не закрываем модальное окно ничьи при клике вне - выбор обязателен
        }
      });
    }
  }

  // ★★★ ИЗМЕНЕНИЕ 5: НОВАЯ ФУНКЦИЯ ДЛЯ ЗАПУСКА НОВОЙ ИГРЫ ★★★
  startNewGame() {
    console.log("Starting new game...");
    this.hideGameOverModal();
    this.showNicknameModal();
  }

  showNicknameModal() {
    if (this.nicknameModal) {
      this.nicknameModal.style.display = "flex";
      if (this.nicknameInput) {
        this.nicknameInput.value = this.username; // Предзаполняем текущим ником
        this.nicknameInput.focus();
      }
    }
  }

  hideNicknameModal() {
    if (this.nicknameModal) {
      this.nicknameModal.style.display = "none";
    }
  }

  confirmNickname() {
    const nickname = this.nicknameInput ? this.nicknameInput.value.trim() : '';
    
    if (nickname && nickname.length >= 2) {
      this.username = nickname;
      this.hideNicknameModal();
      this.resetGame();
      this.updateStatus(`Новая игра началась! Ваш ник: ${this.username}`);
    } else {
      alert('Пожалуйста, введите никнейм (минимум 2 символа)');
    }
  }

  setupRestartModal() {
    if (this.restartModal) {
      this.confirmRestart.addEventListener("click", () => {
        this.confirmRestartAction();
      });

      this.declineRestart.addEventListener("click", () => {
        this.declineRestartAction();
      });

      // Закрытие при клике вне окна
      this.restartModal.addEventListener("click", (e) => {
        if (e.target === this.restartModal) {
          this.hideRestartModal();
        }
      });
    }
  }

  showRestartModal(opponentName) {
    if (this.restartModal && this.restartMessage) {
      this.restartMessage.textContent = `${opponentName} предлагает начать новую игру. Согласны?`;
      this.restartModal.style.display = "flex";
      
      // Блокируем игровое поле пока не будет выбран ответ
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

  offerDraw() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.updateStatus("Нет соединения с сервером");
      return;
    }

    // Отправляем предложение ничьи на сервер
    this.ws.send(
      JSON.stringify({
        type: "drawOffer",
        from: this.username,
      })
    );

    this.updateStatus("Предложение ничьи отправлено...");
  }

  showDrawOfferModal(opponentName) {
    if (this.drawOfferModal && this.drawOfferText) {
      this.drawOfferText.textContent = `${opponentName} предлагает ничью`;
      this.drawOfferModal.style.display = "flex";

      // Блокируем игровое поле пока не будет выбран ответ
      this.board.style.pointerEvents = "none";
    }
  }

  hideDrawOfferModal() {
    if (this.drawOfferModal) {
      this.drawOfferModal.style.display = "none";
      this.board.style.pointerEvents = "auto";
    }
  }

  acceptDrawOffer() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.updateStatus("Нет соединения с сервером");
      return;
    }

    // Отправляем согласие на ничью
    this.ws.send(
      JSON.stringify({
        type: "drawResponse",
        accepted: true,
      })
    );

    this.hideDrawOfferModal();
  }

  rejectDrawOffer() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.updateStatus("Нет соединения с сервером");
      return;
    }

    // Отправляем отказ от ничьи
    this.ws.send(
      JSON.stringify({
        type: "drawResponse",
        accepted: false,
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

    // ★★★ ОБНОВЛЯЕМ ИНФОРМАЦИЮ ОБ ИГРОКАХ ПОСЛЕ УСТАНОВКИ НИКА ★★★
    this.updatePlayersInfo();

    // Обновляем статус с ником
    this.updateStatus(
      `Добро пожаловать, ${username}! Подключение к серверу...`
    );

    // Подключаемся к WebSocket
    this.setupWebSocket();
  }

  // ★★★ ОБНОВЛЕННЫЙ МЕТОД ОБРАБОТКИ КЛИКОВ С УЧЕТОМ МНОЖЕСТВЕННОГО ВЗЯТИЯ ★★★
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

    // ★★★ ЕСЛИ АКТИВНО МНОЖЕСТВЕННОЕ ВЗЯТИЕ - ОБРАБАТЫВАЕМ ОСОБЫМ ОБРАЗОМ ★★★
    if (this.continueCapturePiece) {
      const continueRow = this.continueCapturePiece.row;
      const continueCol = this.continueCapturePiece.col;
      
      // Если кликнули на ту же шашку - сбрасываем выбор
      if (continueRow === row && continueCol === col) {
        this.continueCapturePiece = null;
        this.clearSelection();
        this.updateStatus("Выберите направление для продолжения взятия");
        return;
      }
      
      // Пробуем сделать ход из позиции продолжаемого взятия
      this.makeMove(continueRow, continueCol, row, col);
      this.clearSelection();
      return;
    }

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
      // Отправляем ник при подключении
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

  setupRestartButton() {
    this.restartButton.addEventListener("click", () => {
      this.restartGame();
    });
  }

  restartGame() {
    console.log("Restarting game...");

    // Удаляем стрелку и очищаем таймер
    this.removeMoveArrow();

    // Скрываем блок рестарта
    this.restartContainer.style.display = "none";

    // Показываем доску и статус
    this.board.style.display = "grid";
    this.status.style.display = "block";

    // Сбрасываем состояние игры
    this.selectedPiece = null;
    this.possibleMoves = [];
    this.playerColor = null;
    this.currentPlayer = "white";
    this.continueCapturePiece = null; // Сбрасываем множественное взятие

    // Обновляем статус
    this.updateStatus("Перезапуск игры...");

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

  createMoveArrow(fromRow, fromCol, toRow, toCol) {
    // Удаляем предыдущую стрелку, если есть
    this.removeMoveArrow();

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
    svg.classList.add("move-arrow");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.style.position = "absolute";
    svg.style.top = "0";
    svg.style.left = "0";
    svg.style.pointerEvents = "none";

    // Вычисляем длину и угол стрелки
    const dx = toX - fromX;
    const dy = toY - fromY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

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
    line.classList.add("arrow-line", "arrow-animation");
    line.setAttribute("x1", adjustedFromX);
    line.setAttribute("y1", adjustedFromY);
    line.setAttribute("x2", adjustedToX);
    line.setAttribute("y2", adjustedToY);

    // Создаем наконечник стрелки
    const headLength = 15;
    const headAngle = 30;

    const head = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polygon"
    );
    head.classList.add("arrow-head");

    const angleRad = (angle * Math.PI) / 180;
    const x1 =
      adjustedToX -
      headLength * Math.cos(angleRad - (headAngle * Math.PI) / 180);
    const y1 =
      adjustedToY -
      headLength * Math.sin(angleRad - (headAngle * Math.PI) / 180);
    const x2 =
      adjustedToX -
      headLength * Math.cos(angleRad + (headAngle * Math.PI) / 180);
    const y2 =
      adjustedToY -
      headLength * Math.sin(angleRad + (headAngle * Math.PI) / 180);

    head.setAttribute(
      "points",
      `${adjustedToX},${adjustedToY} ${x1},${y1} ${x2},${y2}`
    );

    svg.appendChild(line);
    svg.appendChild(head);

    // Сохраняем ссылку на стрелку
    this.currentArrow = svg;

    // Добавляем стрелку на доску
    this.board.appendChild(svg);

    // Очищаем предыдущий таймер
    if (this.arrowTimeout) {
      clearTimeout(this.arrowTimeout);
    }

    // Устанавливаем новый таймер для удаления стрелки
    this.arrowTimeout = setTimeout(() => {
      this.removeMoveArrow();
    }, 3000);
  }

  removeMoveArrow() {
    // Очищаем таймер
    if (this.arrowTimeout) {
      clearTimeout(this.arrowTimeout);
      this.arrowTimeout = null;
    }

    // Удаляем стрелку
    if (this.currentArrow) {
      this.currentArrow.remove();
      this.currentArrow = null;
    }
  }

  handleServerMessage(message) {
    switch (message.type) {
      case "playerAssigned":
        this.playerColor = message.color;
        const colorText = this.playerColor === "white" ? "белые" : "чёрные";
        this.updateStatus(
          `Вы играете за ${colorText}. Ожидание второго игрока...`
        );
        // ★★★ ОБНОВЛЯЕМ ИНФОРМАЦИЮ ОБ ИГРОКАХ ★★★
        this.updatePlayersInfo();
        break;

      case "gameState":
        this.updateGameState(message.data);
        break;

      case "moveResult":
        if (message.valid) {
          this.updateGameState(message.gameState);
          
          // ★★★ ОБРАБОТКА МНОЖЕСТВЕННОГО ВЗЯТИЯ ★★★
          if (message.canContinueCapture) {
            this.continueCapturePiece = {
              row: message.continueFromRow,
              col: message.continueFromCol
            };
            this.updateStatus("Можете продолжить взятие! Выберите следующую шашку для взятия.");
          } else {
            this.continueCapturePiece = null; // Сбрасываем множественное взятие
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

      case "drawOfferReceived":
        this.showDrawOfferModal(message.from);
        break;

      case "drawRejected":
        this.updateStatus(`${message.by} отклонил предложение ничьи`);
        break;

      case "gameOver":
        // ★★★ ИЗМЕНЕНИЕ 6: ОБНОВЛЕННАЯ ОБРАБОТКА КОНЦА ИГРЫ С РЕЗУЛЬТАТОМ ★★★
        this.handleGameOver(message);
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

    // Показываем стрелку для ЛЮБОГО хода
    setTimeout(() => {
      this.createMoveArrow(
        moveData.fromRow,
        moveData.fromCol,
        moveData.toRow,
        moveData.toCol
      );
    }, 100);

    // ОБНОВЛЯЕМ ТЕКУЩЕГО ИГРОКА на основе данных от сервера
    if (moveData.currentPlayer) {
      this.currentPlayer = moveData.currentPlayer;
    }

    // ★★★ ОБНОВЛЯЕМ ИНФОРМАЦИЮ ОБ ИГРОКАХ ★★★
    this.updatePlayersInfo();

    // Обновляем статус для ВСЕХ игроков
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
    // Сохраняем имя противника
    if (players.length === 2) {
      const opponent = players.find((p) => p.username !== this.username);
      if (opponent) {
        this.opponentName = opponent.username;
        console.log(
          `Playing against: ${this.opponentName} (${opponent.color})`
        );
        // ★★★ ОБНОВЛЯЕМ ИНФОРМАЦИЮ ОБ ИГРОКАХ ★★★
        this.updatePlayersInfo();
      }
    }
  }

  updateGameState(gameState) {
    // Очищаем доску
    this.clearBoard();

    // Расставляем шашки согласно состоянию игры
    gameState.pieces.forEach((piece) => {
      this.placePiece(piece.row, piece.col, piece.color, piece.isKing);
    });

    // Обновляем текущего игрока
    this.currentPlayer = gameState.currentPlayer;

    // ★★★ ОБНОВЛЯЕМ ИНФОРМАЦИЮ ОБ ИГРОКАХ ★★★
    this.updatePlayersInfo();

    // ОБНОВЛЯЕМ СТАТУС ХОДА
    this.updateTurnStatus();

    console.log("Game state updated. Current player:", this.currentPlayer);
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

  // ★★★ ИЗМЕНЕНИЕ 7: ОБНОВЛЕННАЯ ФУНКЦИЯ ОКОНЧАНИЯ ИГРЫ С РЕЗУЛЬТАТОМ ★★★
  handleGameOver(result) {
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
    
    // ★★★ ОБНОВЛЯЕМ СООБЩЕНИЕ В МОДАЛЬНОМ ОКНЕ ★★★
    const gameOverMessageElement = document.getElementById('gameOverMessage');
    if (gameOverMessageElement) {
      gameOverMessageElement.textContent = gameOverMessage;
    }

    // Удаляем стрелку при окончании игры
    this.removeMoveArrow();

    // Сбрасываем множественное взятие
    this.continueCapturePiece = null;

    // Показываем финальное модальное окно
    this.showGameOverModal();
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
    // Скрываем доску и статус
    this.board.style.display = "none";
    this.status.style.display = "none";

    // Показываем блок рестарта
    this.restartContainer.style.display = "block";
  }

  updateStatus(message) {
    if (this.status) {
      let statusText = message;

      // Если это системное сообщение (с эмодзи), не форматируем его
      const isSystemMessage =
        message.includes("✅") ||
        message.includes("⏳") ||
        message.includes("❌") ||
        message.includes("⚠️") ||
        message.includes("Подключено") ||
        message.includes("Ожидание") ||
        message.includes("Добро пожаловать") ||
        message.includes("Перезапуск") ||
        message.includes("Вы играете") ||
        message.includes("Сейчас не ваш ход") ||
        message.includes("Ход отправляется") ||
        message.includes("Соединение потеряно") ||
        message.includes("Ошибка соединения") ||
        message.includes("Выберите клетку") ||
        message.includes("Предложение ничьи") ||
        message.includes("отклонил предложение") ||
        message.includes("Запрос на новую игру") ||
        message.includes("Согласие на новую игру") ||
        message.includes("отклонил предложение новой игры") ||
        message.includes("Можете продолжить взятие");

      if (this.username && this.playerColor && !isSystemMessage) {
        const colorText = this.playerColor === "white" ? "белые" : "чёрные";
        const currentTurnColor =
          this.currentPlayer === "white" ? "белых" : "чёрных";
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

// ★★★ ИЗМЕНЕНИЕ 8: ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ HTML ★★★
function confirmNickname() {
  if (window.checkersGame) {
    window.checkersGame.confirmNickname();
  }
}

function startNewGame() {
  if (window.checkersGame) {
    window.checkersGame.startNewGame();
  }
}

// Запускаем игру когда страница полностью загружена
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Starting Checkers Game...");
  window.checkersGame = new CheckersGame();
});

// Добавляем обработчик для переподключения при видимости страницы
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    // Страница снова стала активной - проверяем соединение
    console.log("Page became visible, checking connection...");
  }
});
