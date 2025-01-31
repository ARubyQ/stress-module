const moduleName = "stress-module";

// Инициализация модуля
Hooks.once("init", () => {
    console.log(`${moduleName} инициализируется`);
});

// Модуль готов к работе
Hooks.once("ready", () => {
    console.log(`${moduleName} загружен`);
});

// Отображение кнопки "Поднапрячься" в сообщениях чата
Hooks.on("renderChatMessage", (app, html, data) => {
    if (data.message.rolls && data.message.rolls[0] && isAttackRoll(data.message)) {
        const rollId = data.message._id;
        const rollElement = html.find(".message-content");
        let rollData = data.message.rolls[0];

        // Проверка типа данных rollData
        if (typeof rollData === 'string') {
            try {
                rollData = JSON.parse(rollData);
            } catch (error) {
                console.error("Ошибка при разборе JSON:", error);
                return;
            }
        }

        const targetAC = getTargetAC(data.message); // Функция для получения AC цели
        const currentRollTotal = rollData.total;
        const requiredStress = targetAC - currentRollTotal;
        const requiredStress2 = requiredStress + 1;

        // Получаем персонажа
        let character = game.actors.get(data.message.speaker.actor);
        if (!character) return;

        let currentStress = character.system.resources.primary.value;

        // Проверяем, хватает ли напряжения для отображения кнопки
        if (requiredStress > 0 && currentStress >= requiredStress) {
            const reRollButton = `<br><a class="reroll-button" data-roll-id="${rollId}" data-required-stress="${requiredStress}"><i class="fa-solid fa-face-angry"></i> Напряжение +${requiredStress2}</a>`;
            rollElement.append(reRollButton);
        }
    }
});

// Обработка нажатия кнопки
$(document).on("click", ".reroll-button", async (event) => {
    event.preventDefault();
    const rollId = $(event.currentTarget).attr("data-roll-id");
    const requiredStress = parseInt($(event.currentTarget).attr("data-required-stress"));
    let rollMessage = game.messages.get(rollId);
    let rollData = rollMessage.rolls[0];
    let character = game.actors.get(rollMessage.speaker.actor);

    // Проверка типа данных rollData
    if (typeof rollData === 'string') {
        try {
            rollData = JSON.parse(rollData);
        } catch (error) {
            console.error("Ошибка при разборе JSON:", error);
            return;
        }
    }

    if (character) {
        let currentStress = character.system.resources.primary.value;

        if (currentStress >= requiredStress + 1) {
            // Создаем новый объект Roll с обновленным значением
            const newTotal = rollData.total + requiredStress;
            const newRoll = new Roll(rollData.formula);
            await newRoll.evaluate({ async: true });
            newRoll._total = newTotal; // Принудительно устанавливаем новое значение total

            // Обновляем сообщение чата с новым броском
            const newContent = await newRoll.render();
            await rollMessage.update({ content: newContent, rolls: [newRoll.toJSON()] });

            // Обновляем значение напряжения
            await character.update({
                "system.resources.primary.value": currentStress - requiredStress - 1
            });
        }
    }
});

// Обработка создания сообщения в чате
Hooks.on("createChatMessage", async (chatMessage) => {
    if (chatMessage.isRoll && isAttackRoll(chatMessage)) {
        let rollData = chatMessage.rolls[0];

        // Проверка типа данных rollData
        if (typeof rollData === 'string') {
            try {
                rollData = JSON.parse(rollData);
            } catch (error) {
                console.error("Ошибка при разборе JSON:", error);
                return;
            }
        }

        let character = game.actors.get(chatMessage.speaker.actor);
        const targetAC = getTargetAC(chatMessage); // Функция для получения AC цели

        if (rollData.total < targetAC && character) {
            let newStress = character.system.resources.primary.value + 1;
            await character.update({
                "system.resources.primary.value": newStress
            });
        }
    }
});

// Функция для определения, является ли сообщение результатом броска атаки
function isAttackRoll(chatMessage) {
    return chatMessage.flags.dnd5e?.roll?.type === "attack";
}

// Функция для получения AC цели
function getTargetAC(chatMessage) {
    const targets = chatMessage.flags.dnd5e?.targets;
    if (!targets || targets.length === 0) {
        console.warn("Информация о цели отсутствует в сообщении чата.");
        return 1; // Значение AC по умолчанию
    }

    // Предполагаем, что атака направлена на первую цель в списке
    const target = targets[0];
    const targetAC = target.ac;

    if (typeof targetAC !== 'number') {
        console.warn("Класс брони цели не найден или имеет неверный формат.");
        return 1; // Значение AC по умолчанию
    }

    return targetAC;
}
