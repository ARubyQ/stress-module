const moduleName = "stress-module";

const TEMPLATE_DIR = `modules/${moduleName}/templates`;
const STRESS_CHAT_TEMPLATE = `${TEMPLATE_DIR}/stressmessage.hbs`;

Hooks.once("setup", async () => {
    console.log(`${moduleName} инициализируется`);

    await loadTemplates([
        STRESS_CHAT_TEMPLATE
    ]);
});

Hooks.on("ready", function() {
    console.log(`${moduleName} загружен`);
});

Hooks.on("renderChatMessage", (app, html, data) => {
    if (data.message.rolls[0] && game.settings.get('stress-module', 'stress-reroll-button')) {
        const rollId = data.message._id;
        const rollElement = html.find(".message-content");
        const roll = data.message.rolls[0];
        const targetAC = getTargetAC(data); // Функция для получения AC цели
        const currentRollTotal = roll.total;
        const requiredStress = targetAC - currentRollTotal;

        if (requiredStress > 0) {
            const reRollButton = `<br><a class="reroll-button" data-roll-id="${rollId}" data-required-stress="${requiredStress}"><i class="fas fa-dice"></i>Поднапрячься (${requiredStress})</a>`;
            rollElement.append(reRollButton);
        }
    }
});

$(document).on("click", ".reroll-button", async (event) => {
    event.preventDefault();
    const rollId = $(event.currentTarget).attr("data-roll-id");
    const requiredStress = parseInt($(event.currentTarget).attr("data-required-stress"));
    let rollMessage = game.messages.get(rollId);
    const roll = rollMessage.roll;
    let character = game.actors.get(rollMessage.speaker.actor);

    if (character) {
        let currentStress = character.system.resources.primary.value;

        if (currentStress >= requiredStress) {
            // Обновляем значение броска
            roll.total += requiredStress;
            rollMessage.update({ "content": roll.total });

            // Обновляем значение напряжения
            character.update({
                "data.resources.primary.value": currentStress - requiredStress
            });
        } else {
            ui.notifications.warn("Недостаточно напряжения для поднапряжения.");
        }
    }
});

Hooks.on("createChatMessage", async (chatMessage) => {
    if (chatMessage.isRoll && isAttackRoll(chatMessage)) {
        let roll = chatMessage.rolls[0];
        let character = game.actors.get(chatMessage.speaker.actor);
        const targetAC = getTargetAC(chatMessage); // Функция для получения AC цели

        if (roll.total < targetAC && character) {
            let newStress = character.system.resources.primary.value + 1;
            character.update({
                "data.resources.primary.value": newStress
            });
        }
    }
});

function isAttackRoll(chatMessage) {
    // Логика для определения, является ли сообщение результатом броска атаки
    return chatMessage.flags.dnd5e?.roll?.type === "attack";
}

function getTargetAC(chatMessage) {
    // Логика для определения AC цели
    const targetToken = game.scenes.current.tokens.get(chatMessage.flags.target?.token);
    const targetActor = targetToken?.actor;
    return targetActor?.system.attributes.ac.value || 10; // Возвращаем AC цели или 10 по умолчанию
}
