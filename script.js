// script.js - ОБНОВЛЕННАЯ ВЕРСИЯ с чатом и смайликами
class CheckersGame {
  constructor() {
    this.board = document.getElementById("board");
    this.status = document.getElementById("status");
    this.restartContainer = document.getElementById("restartContainer");
    this.restartButton = document.getElementById("restartButton");
    this.loginModal = document.getElementById("loginModal");
    this.usernameInput = document.getElementById("usernameInput");
    this.startGameButton = document.getElementById("startGameButton");

    // Добавляем новые свойства для кнопок
    this.newGameButton = document.getElementById("newGameButton");
    this.drawOfferButton = document.getElementById("drawOfferButton");
    this.surrenderButton = document.getElementById("surrenderButton");
    this.newGameModal = document.getElementById("newGameModal");
    this.drawOfferModal = document.getElementById("drawOfferModal");
    this.surrenderFirstModal = document.getElementById("surrenderFirstModal");
    this.surrenderSecondModal = document.getElementById("surrenderSecondModal");
    this.confirmNewGame = document.getElementById("confirmNewGame");
    this.cancelNewGame = document.getElementById("cancelNewGame");
    this.acceptDraw = document.getElementById("acceptDraw");
    this.rejectDraw = document.getElementById("rejectDraw");
    this.drawOfferText = document.getElementById("drawOfferText");
    this.surrenderFirstConfirm = document.getElementById(
      "surrenderFirstConfirm"
    );
    this.surrenderFinalConfirm = document.getElementById(
      "surrenderFinalConfirm"
    );
    this.surrenderCancel = document.getElementById("surrenderCancel");

    // Добавляем модальное окно для подтверждения перезапуска
    this.restartModal = document.getElementById("restartModal");
    this.restartMessage = document.getElementById("restartMessage");
    this.confirmRestart = document.getElementById("confirmRestart");
    this.declineRestart = document.getElementById("declineRestart");

    // ★★★ ДОБАВЛЕН ЭЛЕМЕНТ УПРАВЛЕНИЯ КНОПКАМИ ★★★
    this.gameControls = document.getElementById("gameControls");

    // ★★★ ДОБАВЛЕНЫ ЭЛЕМЕНТЫ ДЛЯ ДИНАМИЧЕСКОГО ИЗМЕНЕНИЯ ТЕКСТА ★★★
    this.newGameModalTitle = document.getElementById("newGameModalTitle");
    this.newGameModalMessage = document.getElementById("newGameModalMessage");

    // ★★★ ДОБАВЛЕНЫ ЭЛЕМЕНТЫ ДЛЯ ЧАТА И СМАЙЛИКОВ ★★★
    this.chatHistory = document.getElementById("chatHistory");
    this.chatInput = document.getElementById("chatInput");
    this.sendMessageBtn = document.getElementById("sendMessageBtn");
    this.smileyBtns = document.querySelectorAll(".smiley-btn");

    console.log("💬 Chat elements state:", {
      chatHistory: this.chatHistory ? "found" : "not found",
      chatInput: this.chatInput
        ? `found (value: "${this.chatInput.value}")`
        : "not found",
      sendMessageBtn: this.sendMessageBtn ? "found" : "not found",
      smileyBtns: `found ${this.smileyBtns.length} buttons`,
    });

    // Звуки для смайликов
    this.sounds = {
      laugh: document.getElementById("laughSound"),
      sad: document.getElementById("sadSound"),
      cool: document.getElementById("coolSound"),
      suck: document.getElementById("suckSound"),
      think: document.getElementById("thinkSound"),
      smirk: document.getElementById("smirkSound"),
    };

    this.currentPlayer = "white";
    this.selectedPiece = null;
    this.possibleMoves = [];
    this.playerColor = null;
    this.ws = null;
    this.currentArrow = null;
    this.arrowTimeout = null;
    this.username = "";
    this.opponentName = "";

    // ★★★ ДОБАВЛЕНА ПЕРЕМЕННАЯ ДЛЯ ОТСЛЕЖИВАНИЯ СОСТОЯНИЯ ИГРЫ ★★★
    this.gameReady = false; // false - игра не готова, true - можно ходить

    // ★★★ ДОБАВЛЕНЫ НОВЫЕ ПЕРЕМЕННЫЕ ДЛЯ ИНФОРМАЦИИ ОБ ИГРОКАХ ★★★
    this.continueCapturePiece = null; // Для множественного взятия

    // ★★★ ДОБАВЛЕНА ПЕРЕМЕННАЯ ДЛЯ ОТСЛЕЖИВАНИЯ СДАЧИ ★★★
    this.surrenderAttempts = 0; // 0 - первое нажатие, 1+ - последующие

    this.setupLogin();
    this.initializeGame();
    this.setupRestartButton();
    this.setupGameControls();
    this.setupRestartModal();
    this.setupChatAndSmileys(); // ★★★ ДОБАВЛЕН ВЫЗОВ ★★★

    // ★★★ ДОБАВЛЕН ВЫЗОВ ФУНКЦИИ ДЛЯ ОБНОВЛЕНИЯ ИНФОРМАЦИИ ОБ ИГРОКАХ ★★★
    this.updatePlayersInfo();
  }

  // ★★★ МЕТОДЫ ДЛЯ ЧАТА И СМАЙЛИКОВ ★★★
  setupChatAndSmileys() {
    console.log("💬 Setting up chat and smileys...");

    // Обработчики для отправки сообщений
    if (this.sendMessageBtn && this.chatInput) {
      this.sendMessageBtn.addEventListener("click", () => {
        console.log("🖱️ Send button clicked");
        const message = this.chatInput.value.trim();
        console.log("📝 Message to send:", message);
        this.sendChatMessage(message, false);
      });

      this.chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          console.log("⌨️ Enter key pressed");
          const message = this.chatInput.value.trim();
          console.log("📝 Message to send:", message);
          this.sendChatMessage(message, false);
        }
      });

      console.log("✅ Chat event listeners set up");
    } else {
      console.log("❌ Chat elements not found:", {
        sendMessageBtn: !!this.sendMessageBtn,
        chatInput: !!this.chatInput,
      });
    }

    // Обработчики для смайликов
    if (this.smileyBtns && this.smileyBtns.length > 0) {
      this.smileyBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const smiley = btn.getAttribute("data-smiley");
          const soundType = btn.getAttribute("data-sound");
          console.log("😊 Smiley clicked:", smiley, soundType);
          this.sendSmiley(smiley, soundType);
        });
      });
      console.log("✅ Smiley event listeners set up");
    } else {
      console.log("❌ Smiley buttons not found");
    }
  }

  // Отправка обычного сообщения
  sendChatMessage(message, isSmiley = false) {
    console.log("📤 sendChatMessage called with:", { message, isSmiley });

    if (!message) {
      console.log("❌ Message is null or undefined");
      return;
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      console.log("❌ Empty message after trimming, not sending");
      // Можно добавить визуальную обратную связь
      this.chatInput.placeholder = "Введите сообщение...";
      this.chatInput.focus();
      return;
    }

    // Проверяем соединение
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log("❌ WebSocket not connected");
      this.updateStatus("Нет соединения с сервером");
      return;
    }

    console.log("📤 Sending chat message to server:", {
      message: trimmedMessage,
      isSmiley,
      username: this.username,
    });

    // Отправка на сервер
    this.ws.send(
      JSON.stringify({
        type: "chatMessage",
        message: trimmedMessage,
        isSmiley: isSmiley,
        player: this.username,
      })
    );

    this.chatInput.value = "";
    console.log("✅ Chat message sent successfully, input cleared");
  }

  // Отправка смайлика
  sendSmiley(smiley, soundType) {
    console.log(`Sending smiley: ${smiley} with sound: ${soundType}`);

    // Воспроизведение звука (заглушка - добавим позже файлы)
    this.playSmileySound(soundType);

    // Отправляем смайлик как сообщение
    this.sendChatMessage(smiley, true);
  }

  // Воспроизведение звука смайлика
  playSmileySound(soundType) {
  try {
    const sound = this.sounds[soundType];
    if (sound) {
      sound.volume = 0.2; // ★★★ ГРОМКОСТЬ 30% ★★★
      sound.currentTime = 0;
      sound.play().catch((e) => {
        console.log("Audio play error:", e);
      });
    }
  } catch (error) {
    console.log("Sound play error:", error);
  }
}

  // Отображение сообщения в чате
  displayChatMessage(playerName, message, isSmiley = false, isSystem = false) {
    console.log("🎯 displayChatMessage called with:", {
      playerName,
      message,
      isSmiley,
      isSystem,
    });

    console.log("💬 Displaying chat message:", {
      playerName,
      message,
      isSmiley,
      isSystem,
    });

    const messageDiv = document.createElement("div");

    if (isSystem || playerName === "system") {
      messageDiv.className = "chat-message system";
      messageDiv.textContent = message;
      console.log("🔧 System message created");
    } else {
      // Определяем класс для стилизации сообщения
      const messageClass = playerName === this.username ? "player1" : "player2";
      messageDiv.className = `chat-message ${messageClass}`;

      if (isSmiley) {
        messageDiv.innerHTML = `<strong>${playerName}:</strong> ${message}`;
        console.log("😊 Smiley message created");
      } else {
        messageDiv.textContent = `${playerName}: ${message}`;
        console.log("📝 Regular message created");
      }
    }

    this.chatHistory.appendChild(messageDiv);
    console.log("✅ Message added to chat history");

    // Прокручиваем к последнему сообщению
    this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    console.log("📜 Scrolled to bottom");

    // Ограничиваем количество сообщений (последние 20)
    this.limitChatMessages();
  }

  // Ограничение количества сообщений в чате
  limitChatMessages() {
    if (!this.chatHistory) return;

    const messages = this.chatHistory.querySelectorAll(".chat-message");
    if (messages.length > 20) {
      messages[0].remove();
    }
  }

  // Очистка истории чата
  clearChatHistory() {
    if (this.chatHistory) {
      this.chatHistory.innerHTML = "";
      // Добавляем системное сообщение
      this.displayChatMessage("", "Чат очищен", false, true);
    }
  }

  // Определение типа звука по смайлику
  getSoundTypeBySmiley(smiley) {
    const smileyMap = {
      "😂": "laugh",
      "😢": "sad",
      "👍": "cool",
      "👎": "suck",
      "🤔": "think",
      "😏": "smirk",
    };

    return smileyMap[smiley] || null;
  }

  initializeGame() {
    this.createBoard();
    this.updateStatus("Введите ваш ник для начала игры...");
  }

  // ★★★ ОБНОВЛЕННЫЙ МЕТОД - ПРАВИЛЬНАЯ РАССТАНОВКА НА ЧЕРНЫХ КЛЕТКАХ ★★★
  createBoard() {
    const board = document.getElementById("board");
    if (!board) return;

    board.innerHTML = "";

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const cell = document.createElement("div");
        cell.className = `cell ${(row + col) % 2 === 0 ? "white" : "black"}`;
        cell.dataset.row = row;
        cell.dataset.col = col;

        // Добавляем обработчик клика только на черные клетки
        if ((row + col) % 2 !== 0) {
          cell.addEventListener("click", (e) => {
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
        if ((row + col) % 2 === 1) {
          // Только черные клетки
          this.placePiece(row, col, "black");
        }
      }
    }

    // Белые шашки (нижние 3 ряда)
    for (let row = 5; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) {
          // Только черные клетки
          this.placePiece(row, col, "white");
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
    const existingPiece = cell.querySelector(".piece");
    if (existingPiece) {
      existingPiece.remove();
    }

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
    img.style.width = "80%";
    img.style.height = "80%";

    img.onerror = () => {
      console.error(`Failed to load image: ${imageSrc}`);
      // Запасной вариант - цветной круг
      piece.style.backgroundColor = color;
      piece.style.border = "2px solid #000";
      piece.style.borderRadius = "50%";
      piece.style.width = "40px";
      piece.style.height = "40px";
      piece.style.display = "flex";
      piece.style.alignItems = "center";
      piece.style.justifyContent = "center";
      if (isKing) {
        piece.innerHTML = "♔";
        piece.style.color = "gold";
        piece.style.fontWeight = "bold";
      }
    };

    piece.appendChild(img);
    cell.appendChild(piece);
  }

  // ★★★ ОБНОВЛЕННЫЙ МЕТОД СБРОСА ИГРЫ ★★★
  resetGame() {
    console.log("Resetting game to initial state...");

    // ★★★ СБРАСЫВАЕМ СОСТОЯНИЕ ГОТОВНОСТИ ★★★
    this.gameReady = false;

    // ★★★ СБРАСЫВАЕМ СЧЕТЧИК СДАЧИ ★★★
    this.surrenderAttempts = 0;

    // Сбрасываем игровые переменные
    this.currentPlayer = "white";
    this.selectedPiece = null;
    this.possibleMoves = [];
    // ★★★ НЕ СБРАСЫВАЕМ playerColor, username и opponentName ★★★
    // this.playerColor = null;
    // this.username = "";
    // this.opponentName = "";
    this.continueCapturePiece = null; // Сбрасываем множественное взятие

    // Удаляем стрелку
    this.removeMoveArrow();

    // Очищаем доску и пересоздаём с начальной расстановкой
    this.clearBoard();
    this.createBoard();

    // Обновляем информацию об игрокай
    this.updatePlayersInfo();

    // Обновляем статус
    this.updateStatus("Новая игра началась! Ожидание подключения...");
  }

  clearBoard() {
    // Очищаем все шашки с доски
    document.querySelectorAll(".piece").forEach((piece) => piece.remove());
  }

  // ★★★ ОБНОВЛЕННЫЙ МЕТОД ДЛЯ ОБНОВЛЕНИЯ ИНФОРМАЦИИ ОБ ИГРОКАХ ★★★
  updatePlayersInfo() {
    const whitePlayer = document.getElementById("whitePlayer");
    const blackPlayer = document.getElementById("blackPlayer");

    if (!whitePlayer || !blackPlayer) return;

    const whiteIndicator = whitePlayer.querySelector(".turn-indicator");
    const blackIndicator = blackPlayer.querySelector(".turn-indicator");

    // Сбрасываем индикаторы
    whitePlayer.classList.remove("active");
    blackPlayer.classList.remove("active");

    // ★★★ ИСПРАВЛЕННАЯ ЛОГИКА ОТОБРАЖЕНИЯ НИКОВ ★★★
    const whiteNickname = document.getElementById("whiteNickname");
    const blackNickname = document.getElementById("blackNickname");

    if (whiteNickname && blackNickname) {
      // Определяем ник для белых
      if (this.playerColor === "white") {
        whiteNickname.textContent = this.username || "Вы";
        blackNickname.textContent = this.opponentName || "Ожидание...";
      }
      // Определяем ник для черных
      else if (this.playerColor === "black") {
        whiteNickname.textContent = this.opponentName || "Ожидание...";
        blackNickname.textContent = this.username || "Вы";
      }
      // Если цвет еще не назначен
      else {
        whiteNickname.textContent = "Ожидание...";
        blackNickname.textContent = "Ожидание...";
      }
    }

    // Активируем текущего игрока
    if (this.currentPlayer === "white") {
      whitePlayer.classList.add("active");
    } else {
      blackPlayer.classList.add("active");
    }

    // ★★★ ДОБАВИМ ОТЛАДОЧНЫЙ ВЫВОД ★★★
    console.log("🔄 Updated players info:", {
      playerColor: this.playerColor,
      username: this.username,
      opponentName: this.opponentName,
      currentPlayer: this.currentPlayer,
    });
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
    // Обработчики для кнопки "Новая Игра"
    this.newGameButton.addEventListener("click", () => {
      this.showNewGameModal();
    });

    this.confirmNewGame.addEventListener("click", () => {
      this.confirmNewGameAction();
    });

    this.cancelNewGame.addEventListener("click", () => {
      this.hideNewGameModal();
    });

    // Обработчики для кнопки "Ничья?"
    this.drawOfferButton.addEventListener("click", () => {
      this.offerDraw();
    });

    this.acceptDraw.addEventListener("click", () => {
      this.acceptDrawOffer();
    });

    this.rejectDraw.addEventListener("click", () => {
      this.rejectDrawOffer();
    });

    // ★★★ ДОБАВЛЕНЫ ОБРАБОТЧИКИ ДЛЯ КНОПКИ "СДАТЬСЯ" ★★★
    this.surrenderButton.addEventListener("click", () => {
      this.offerSurrender();
    });

    this.surrenderFirstConfirm.addEventListener("click", () => {
      this.confirmFirstSurrender();
    });

    this.surrenderFinalConfirm.addEventListener("click", () => {
      this.confirmFinalSurrender();
    });

    this.surrenderCancel.addEventListener("click", () => {
      this.cancelSurrender();
    });

    // ★★★ ДОБАВЛЕНЫ ОБРАБОТЧИКИ ДЛЯ КНОПОК НОВОЙ ИГРЫ ★★★
    this.confirmRestart.addEventListener("click", () => {
      this.acceptNewGame();
    });

    this.declineRestart.addEventListener("click", () => {
      this.rejectNewGame();
    });

    // Закрытие модальных окон при клике вне их
    this.newGameModal.addEventListener("click", (e) => {
      if (e.target === this.newGameModal) {
        this.hideNewGameModal();
      }
    });

    this.drawOfferModal.addEventListener("click", (e) => {
      if (e.target === this.drawOfferModal) {
        // Не закрываем модальное окно ничьи при клике вне - выбор обязателен
      }
    });

    // ★★★ ДОБАВЛЕНЫ ОБРАБОТЧИКИ ДЛЯ МОДАЛЬНЫХ ОКОН СДАЧИ ★★★
    this.surrenderFirstModal.addEventListener("click", (e) => {
      if (e.target === this.surrenderFirstModal) {
        this.hideSurrenderFirstModal();
      }
    });

    this.surrenderSecondModal.addEventListener("click", (e) => {
      if (e.target === this.surrenderSecondModal) {
        this.hideSurrenderSecondModal();
      }
    });

    this.restartModal.addEventListener("click", (e) => {
      if (e.target === this.restartModal) {
        this.hideRestartModal();
      }
    });
  }

  setupRestartModal() {
    // Обработчики уже настроены в setupGameControls
  }

  // ★★★ ОБНОВЛЕННЫЕ МЕТОДЫ ДЛЯ КНОПКИ "СДАТЬСЯ" ★★★
  offerSurrender() {
    console.log(
      "Surrender button clicked. Attempt:",
      this.surrenderAttempts + 1
    );

    // Проверяем соединение
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.updateStatus("Нет соединения с сервером");
      return;
    }

    // Проверяем, что игра идет
    if (!this.gameReady) {
      this.updateStatus("Игра еще не началась");
      return;
    }

    // ★★★ ИСПРАВЛЕННАЯ ЛОГИКА ★★★
    if (this.surrenderAttempts === 0) {
      // Первое нажатие - показываем только первое окно
      console.log("First surrender attempt - showing first modal");
      this.showSurrenderFirstModal();
      // НЕ увеличиваем счетчик здесь - увеличим только после подтверждения в первом окне
    } else if (this.surrenderAttempts === 1) {
      // Второе нажатие - показываем второе окно
      console.log("Second surrender attempt - showing second modal");
      this.showSurrenderSecondModal();
    } else {
      // Третье и последующие нажатия - тоже показываем второе окно
      console.log("Subsequent surrender attempt - showing second modal");
      this.showSurrenderSecondModal();
    }
  }

  showSurrenderFirstModal() {
    if (this.surrenderFirstModal) {
      this.surrenderFirstModal.style.display = "flex";
      // Блокируем игровое поле пока не будет выбран ответ
      this.board.style.pointerEvents = "none";
    }
  }

  hideSurrenderFirstModal() {
    if (this.surrenderFirstModal) {
      this.surrenderFirstModal.style.display = "none";
      this.board.style.pointerEvents = "auto";
    }
  }

  showSurrenderSecondModal() {
    if (this.surrenderSecondModal) {
      this.surrenderSecondModal.style.display = "flex";
      // Блокируем игровое поле пока не будет выбран ответ
      this.board.style.pointerEvents = "none";
    }
  }

  hideSurrenderSecondModal() {
    if (this.surrenderSecondModal) {
      this.surrenderSecondModal.style.display = "none";
      this.board.style.pointerEvents = "auto";
    }
  }

  confirmFirstSurrender() {
    console.log(
      "First surrender confirmed, increasing counter and closing modal"
    );

    // ★★★ ИСПРАВЛЕННАЯ ЛОГИКА ★★★
    // Увеличиваем счетчик ТОЛЬКО после подтверждения в первом окне
    this.surrenderAttempts = 1;

    // Закрываем первое окно
    this.hideSurrenderFirstModal();

    // ★★★ ВАЖНО: УБЕДИТЕСЬ ЧТО ВТОРОЕ ОКНО СКРЫТО ★★★
    this.hideSurrenderSecondModal();

    this.updateStatus("Русские не сдаются! 💪");
  }

  confirmFinalSurrender() {
    console.log("Final surrender confirmed, sending surrender to server");

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "surrender",
        })
      );
      this.updateStatus("Вы сдались. Ожидание подтверждения...");
    }

    this.hideSurrenderSecondModal();
  }

  cancelSurrender() {
    console.log("Final surrender cancelled");
    this.hideSurrenderSecondModal();
    this.updateStatus("Продолжаем бой! 💪");
  }

  // ★★★ ОБНОВЛЕННЫЕ МЕТОДЫ ДЛЯ НОВОЙ ИГРЫ ★★★
  showNewGameModal() {
    // Устанавливаем стандартный текст для модального окна
    if (this.newGameModalTitle && this.newGameModalMessage) {
      this.newGameModalTitle.textContent = "Новая Игра";
      this.newGameModalMessage.textContent =
        "Вы уверены, что хотите начать Новую Игру?";
    }

    // Восстанавливаем стандартные кнопки
    this.confirmNewGame.textContent = "Да";
    this.confirmNewGame.onclick = () => this.confirmNewGameAction();
    this.cancelNewGame.textContent = "Нет";
    this.cancelNewGame.style.display = "block";

    this.newGameModal.style.display = "flex";
  }

  hideNewGameModal() {
    this.newGameModal.style.display = "none";
  }

  confirmNewGameAction() {
    console.log("Confirming new game...");

    // ★★★ ДОБАВИМ ПРОВЕРКУ СОЕДИНЕНИЯ ★★★
    if (!this.ws) {
      console.error("❌ WebSocket not initialized");
      this.updateStatus("Ошибка: соединение не установлено");
      return;
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      console.error("❌ WebSocket not open, state:", this.ws.readyState);
      this.updateStatus("Нет соединения с сервером");
      return;
    }

    // ★★★ НОВАЯ ЛОГИКА: отправляем запрос на новую игру противнику ★★★
    console.log("📤 Sending newGameRequest to server...");
    this.ws.send(
      JSON.stringify({
        type: "newGameRequest",
        from: this.username,
      })
    );

    // ★★★ ПОКАЗЫВАЕМ ОКНО ОЖИДАНИЯ ★★★
    this.showNewGameWaiting();
    this.updateStatus("Запрос на новую игру отправлен противнику...");

    this.hideNewGameModal();
  }

  // ★★★ МЕТОД ДЛЯ ПОКАЗА ОЖИДАНИЯ ОТВЕТА ★★★
  showNewGameWaiting() {
    if (this.newGameModalTitle && this.newGameModalMessage) {
      this.newGameModalTitle.textContent = "Ожидание ответа";
      this.newGameModalMessage.textContent =
        "Запрос на новую игру отправлен. Ожидаем ответа противника...";

      // Меняем кнопки для режима ожидания
      this.confirmNewGame.textContent = "Отмена";
      this.confirmNewGame.onclick = () => this.cancelNewGameWaiting();
      this.cancelNewGame.style.display = "none"; // Скрываем вторую кнопку

      this.newGameModal.style.display = "flex";
    }
  }

  // ★★★ МЕТОД ДЛЯ ОТМЕНЫ ОЖИДАНИЯ ★★★
  cancelNewGameWaiting() {
    this.hideNewGameModal();
    this.updateStatus("Ожидание новой игры отменено");
  }

  // ★★★ МЕТОД ДЛЯ ПОКАЗА ЗАПРОСА НОВОЙ ИГРЫ ОТ ПРОТИВНИКА ★★★
  showNewGameRequestModal(opponentName) {
    // ★★★ ВАЖНО: ИСПОЛЬЗУЕМ restartModal ДЛЯ ЗАПРОСОВ НОВОЙ ИГРЫ ★★★
    if (this.restartModal && this.restartMessage) {
      this.restartMessage.textContent = `${opponentName} предлагает начать новую игру. Согласны?`;
      this.restartModal.style.display = "flex";

      // Блокируем игровое поле пока не будет выбран ответ
      this.board.style.pointerEvents = "none";
    }
    console.log("🔄 New game request modal shown for:", opponentName);
  }

  hideRestartModal() {
    if (this.restartModal) {
      this.restartModal.style.display = "none";
      this.board.style.pointerEvents = "auto";
    }
  }

  // ★★★ МЕТОДЫ ДЛЯ ПРИНЯТИЯ/ОТКЛОНЕНИЯ НОВОЙ ИГРЫ ★★★
  acceptNewGame() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "newGameResponse",
          accepted: true,
        })
      );
    }
    this.hideRestartModal();
    // Игра начнется когда сервер пришлет gameRestarted
  }

  rejectNewGame() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "newGameResponse",
          accepted: false,
        })
      );
    }
    this.hideRestartModal();
    this.updateStatus("Вы отклонили предложение новой игры");
  }

  // ★★★ МЕТОД ДЛЯ ПОЛНОГО СБРОСА ИГРЫ ★★★
  startFreshGame() {
    console.log("🔄 Starting fresh game...");

    // ★★★ ПОЛНЫЙ СБРОС ИГРЫ ★★★
    this.surrenderAttempts = 0;
    this.currentPlayer = "white";
    this.selectedPiece = null;
    this.possibleMoves = [];
    this.continueCapturePiece = null;
    // ★★★ НЕ СБРАСЫВАЕМ opponentName! ★★★
    // this.opponentName = ""; // ★★★ УБРАТЬ ЭТУ СТРОКУ ★★★

    // ★★★ НЕ СБРАСЫВАЕМ playerColor и username ★★★

    // Удаляем стрелку
    this.removeMoveArrow();

    // Очищаем доску и пересоздаем с начальной расстановкой
    this.clearBoard();
    this.createBoard();

    // ★★★ ОЧИЩАЕМ ЧАТ ПРИ НОВОЙ ИГРЕ ★★★
    this.clearChatHistory();

    // ★★★ ВАЖНО: ПОКАЗЫВАЕМ КНОПКИ УПРАВЛЕНИЯ ★★★
    if (this.gameControls) {
      this.gameControls.style.display = "flex";
    }

    // Обновляем информацию об игроках
    this.updatePlayersInfo();

    // Обновляем статус
    this.updateStatus("Новая игра началась! Ожидание подключения...");

    // Скрываем окно ожидания если оно открыто
    this.hideNewGameModal();

    // ★★★ СКРЫВАЕМ МОДАЛЬНОЕ ОКНО ОКОНЧАНИЯ ИГРЫ ★★★
    this.hideGameOverModal();

    console.log("✅ Fresh game started, opponent:", this.opponentName);
  }

  // ★★★ ДОБАВЛЕН МЕТОД ДЛЯ СКРЫТИЯ МОДАЛЬНОГО ОКНА ★★★
  hideGameOverModal() {
    const modal = document.getElementById("gameOverModal");
    if (modal) {
      modal.style.display = "none";
    }

    // Показываем кнопки управления снова
    if (this.gameControls) {
      this.gameControls.style.display = "flex";
    }
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
    this.drawOfferText.textContent = `${opponentName} предлагает ничью`;
    this.drawOfferModal.style.display = "flex";

    // Блокируем игровое поле пока не будет выбран ответ
    this.board.style.pointerEvents = "none";
  }

  hideDrawOfferModal() {
    this.drawOfferModal.style.display = "none";
    this.board.style.pointerEvents = "auto";
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

  // ★★★ ОБНОВЛЕННЫЙ МЕТОД ОБРАБОТКИ КЛИКОВ С ПРОВЕРКОЙ ГОТОВНОСТИ ИГРЫ ★★★
  handleCellClick(row, col) {
    console.log("Cell clicked:", row, col, "Game ready:", this.gameReady);

    // ★★★ ПЕРВАЯ ПРОВЕРКА: ИГРА ДОЛЖНА БЫТЬ ГОТОВА ★★★
    if (!this.gameReady) {
      this.updateStatus("⏳ Ожидание подключения второго игрока...");
      return;
    }

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

    try {
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
    } catch (error) {
      console.error("💥 Failed to create WebSocket:", error);
      this.updateStatus("Ошибка создания соединения");
    }
  }

  handleServerMessage(message) {
    console.log("📨 Received message type:", message.type, "Data:", message);

    switch (message.type) {
      // ★★★ ДОБАВЛЕНО: Обработка готовности игры ★★★
      case "gameReady":
        console.log("✅ Game is ready to play!");
        this.gameReady = true;
        this.updateStatus("✅ Оба игрока подключены! Ваш ход!");

        // ★★★ ДОБАВЛЯЕМ СООБЩЕНИЕ В ЧАТ ★★★
        this.displayChatMessage("", "Игра началась! Удачи!", false, true);
        break;

      case "playerDisconnected":
        this.gameReady = false;
        this.updateStatus(message.message);
        break;

      case "playerAssigned":
        this.playerColor = message.color;
        const colorText = this.playerColor === "white" ? "белые" : "чёрные";
        this.updateStatus(
          `Вы играете за ${colorText}. Ожидание второго игрока...`
        );
        this.updatePlayersInfo();
        break;

      case "gameState":
        this.updateGameState(message.data);
        break;

      case "moveResult":
        if (message.valid) {
          this.updateGameState(message.gameState);

          // ★★★ ОБРАБОТКА МНОЖЕСТВЕННОГО ВЗЯТИЯ ★★★
          if (message.canContinue) {
            this.continueCapturePiece = {
              row: message.gameState.continueCapture?.position?.row,
              col: message.gameState.continueCapture?.position?.col,
            };
            this.updateStatus(
              "Можете продолжить взятие! Выберите следующую шашку для взятия."
            );
          } else {
            this.continueCapturePiece = null; // Сбрасываем множественное взятие
          }
        } else {
          this.updateStatus(`❌ ${message.message}`);
        }
        break;

      // ★★★ ДОБАВЛЕН ОБРАБОТЧИК ДЛЯ ПРОДОЛЖЕНИЯ ВЗЯТИЯ ★★★
      case "canContinueCapture":
        this.continueCapturePiece = {
          row: message.position.row,
          col: message.position.col,
        };
        this.updateStatus(
          "Можете продолжить взятие! Выберите следующую шашку для взятия."
        );
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

      // ★★★ ИСПРАВЛЕННЫЙ КОД - ЗАМЕНИТЕ СТАРЫЙ БЛОК ★★★
      case "chatMessage":
        console.log("💬 Received chat message:", message);
        this.displayChatMessage(
          message.player,
          message.message,
          message.isSmiley,
          message.player === "system"
        );

        // Воспроизводим звук если это смайлик от другого игрока
        if (message.isSmiley && message.player !== this.username) {
          const soundType = this.getSoundTypeBySmiley(message.message);
          if (soundType) {
            console.log("🔊 Playing smiley sound:", soundType);
            this.playSmileySound(soundType);
          }
        }
        break; // ★★★ ВАЖНО: break ДОЛЖЕН БЫТЬ ЗДЕСЬ ★★★

      case "chatHistory":
        if (message.messages && Array.isArray(message.messages)) {
          if (this.chatHistory) {
            this.chatHistory.innerHTML = "";
          }
          message.messages.forEach((msg) => {
            this.displayChatMessage(
              msg.player,
              msg.message,
              msg.isSmiley,
              msg.player === "system"
            );
          });
        }
        break;

      // ★★★ ОБРАБОТКА НОВЫХ СООБЩЕНИЙ ДЛЯ НОВОЙ ИГРЫ ★★★
      case "newGameRequest":
        this.showNewGameRequestModal(message.from);
        break;

      case "newGameAccepted":
        this.hideNewGameModal();
        this.updateStatus("Противник принял предложение новой игры");
        break;

      case "newGameRejected":
        this.hideNewGameModal();
        this.updateStatus("Противник отклонил предложение новой игры");
        break;

      case "gameOver":
        if (message.result === "draw") {
          this.handleGameOver({ winner: null, result: "draw" });
        } else {
          // ★★★ ИСПРАВЛЕННАЯ ОБРАБОТКА СДАЧИ ★★★
          if (message.result === "surrender") {
            const winner = message.winner;
            const surrenderedBy = message.surrenderedBy;
            const surrenderedByColor = message.surrenderedByColor;

            const winnerName =
              winner === this.playerColor ? this.username : this.opponentName;
            const loserName =
              surrenderedByColor === this.playerColor
                ? this.username
                : this.opponentName;
            const colorText =
              surrenderedByColor === "white" ? "белые" : "чёрные";

            this.updateStatus(
              `🏆 ${winnerName} Победитель! ${loserName} (${colorText}) сдался`
            );

            this.handleGameOver({
              winner: winner,
              result: "win",
              surrender: true,
              surrenderedPlayer: surrenderedByColor,
              message: `🏆 ${winnerName} Победитель! ${loserName} (${colorText}) сдался`,
            });
          } else {
            this.handleGameOver(message);
          }
        }
        break;

      case "gameRestarted":
        console.log("🔄 Game restarted message received");
        this.startFreshGame();
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

  handlePlayersInfo(players) {
    console.log("Players info:", players);

    // ★★★ УЛУЧШЕННАЯ ЛОГИКА СОХРАНЕНИЯ НИКА ПРОТИВНИКА ★★★
    const opponent = players.find((p) => p.username !== this.username);
    if (opponent) {
      const oldOpponentName = this.opponentName;
      this.opponentName = opponent.username;

      // ★★★ ДОБАВЛЯЕМ СООБЩЕНИЕ В ЧАТ ПРИ ПОДКЛЮЧЕНИИ ПРОТИВНИКА ★★★
      if (!oldOpponentName && this.opponentName) {
        this.displayChatMessage(
          "",
          `Игрок ${this.opponentName} присоединился к игре`,
          false,
          true
        );
      }

      console.log(`Playing against: ${this.opponentName} (${opponent.color})`);
    } else if (players.length === 1) {
      // Если только один игрок (мы сами), сбрасываем opponentName
      this.opponentName = "";
    }

    // ★★★ ОБНОВЛЯЕМ ИНФОРМАЦИЮ ОБ ИГРОКАХ ДЛЯ ВСЕХ СЛУЧАЕВ ★★★
    this.updatePlayersInfo();

    console.log("Current opponent name:", this.opponentName);
  }

  setupRestartButton() {
    this.restartButton.addEventListener("click", () => {
      this.restartGame();
    });
  }

  // ★★★ ИСПРАВЛЕННЫЙ МЕТОД restartGame ★★★
  restartGame() {
    console.log("Restarting game via restart button");

    // ★★★ ПРОСТО ВЫЗЫВАЕМ startFreshGame ★★★
    this.startFreshGame();

    // Удаляем стрелку и очищаем таймер
    this.removeMoveArrow();

    // Скрываем блок рестарта
    this.restartContainer.style.display = "none";

    // Показываем доску и статус
    this.board.style.display = "grid";
    this.status.style.display = "block";
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

  // ★★★ ОБНОВЛЕННЫЙ МЕТОД ДЛЯ УЧЕТА МНОЖЕСТВЕННОГО ВЗЯТИЯ ★★★
  updateTurnStatus() {
    if (this.continueCapturePiece) {
      this.updateStatus("Продолжайте взятие! Выберите следующую шашку.");
    } else if (this.currentPlayer === this.playerColor) {
      this.updateStatus("✅ Ваш ход!");
    } else {
      this.updateStatus("⏳ Ход противника...");
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

  handleGameOver(result) {
    let winnerText;
    let gameOverMessage;

    if (result.result === "draw") {
      winnerText = "🤝 Ничья!";
      gameOverMessage = "🤝 Ничья!";
    } else if (result.winner) {
      // ★★★ ИСПРАВЛЕННАЯ ЛОГИКА ОТОБРАЖЕНИЯ ПОБЕДИТЕЛЯ ★★★
      if (result.surrender) {
        const winnerName =
          result.winner === this.playerColor
            ? this.username
            : this.opponentName;
        const surrenderedPlayer = result.surrenderedPlayer;
        const loserName =
          surrenderedPlayer === this.playerColor
            ? this.username
            : this.opponentName;

        winnerText = `🏆 ${winnerName} победил!`;
        gameOverMessage = `🏆 ${winnerName} победил!\n${loserName} сдался`;
      } else {
        // Обычная победа
        const winnerName =
          result.winner === this.playerColor
            ? this.username
            : this.opponentName;
        const loserName =
          result.winner === this.playerColor
            ? this.opponentName
            : this.username;

        winnerText = `🏆 ${winnerName} победил!`;
        gameOverMessage = `🏆 ${winnerName} победил!\nпротив ${loserName}`;
      }
    } else {
      winnerText = "🤝 Ничья!";
      gameOverMessage = "🤝 Ничья!";
    }

    this.updateStatus(`Игра окончена! ${winnerText}`);

    // Удаляем стрелку при окончании игры
    this.removeMoveArrow();

    // Скрываем кнопки управления при окончании игры
    if (this.gameControls) {
      this.gameControls.style.display = "none";
    }

    // ★★★ ВАЖНО: ИСПОЛЬЗУЕМ gameOverModal ДЛЯ ОКОНЧАНИЯ ИГРЫ ★★★
    const modal = document.getElementById("gameOverModal");
    const messageElement = document.getElementById("gameOverMessage");
    if (modal && messageElement) {
      messageElement.textContent = gameOverMessage;
      modal.style.display = "flex";
    }

    console.log("🎮 Game over modal shown:", gameOverMessage);
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
        message.includes("🎯") ||
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
        message.includes("Можете продолжить взятие") ||
        message.includes("Вы сдались") ||
        message.includes("Продолжаем бой") ||
        message.includes("Русские не сдаются");

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

// ★★★ ИСПРАВЛЕННАЯ ГЛОБАЛЬНАЯ ФУНКЦИЯ ★★★
function startNewGame() {
  console.log("🔄 startNewGame called globally");

  if (
    window.checkersGame &&
    typeof window.checkersGame.showNewGameModal === "function"
  ) {
    // Сначала скрываем модальное окно окончания игры
    window.checkersGame.hideGameOverModal();
    // Показываем окно новой игры
    window.checkersGame.showNewGameModal();
  } else {
    console.error("❌ checkersGame not available, reloading page");
    location.reload();
  }
}

// Запускаем игру когда страница полностью загружена
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Starting Checkers Game...");
  window.checkersGame = new CheckersGame(); // ★★★ СОХРАНЯЕМ В ГЛОБАЛЬНУЮ ПЕРЕМЕННУЮ ★★★
});

// Добавляем обработчик для переподключения при видимости страницы
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    // Страница снова стала активной - проверяем соединение
    console.log("Page became visible, checking connection...");
  }
});


