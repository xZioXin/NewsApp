const amqp = require("amqplib");

let channel;
const NEWS_QUEUE = "news_updates";
const NOTIFICATION_QUEUE = "notifications";

async function initRabbitMQ() {
    try {
        const connection = await amqp.connect(process.env.RABBITMQ_URL || "amqp://localhost", {
            timeout: 5000
        }).catch(err => {
            console.error("Помилка підключення до RabbitMQ:", err);
            throw err;
        });
        channel = await connection.createChannel();
        console.log("RabbitMQ підключено");
    } catch (err) {
        console.error("Критична помилка RabbitMQ:", err.message);
    }
}

function sendToQueue(data, queueName = NEWS_QUEUE) {
    if (!channel) {
        console.warn("RabbitMQ не доступний, повідомлення не відправлено");
        return false;
    }
    
    try {
        channel.sendToQueue(
            queueName,
            Buffer.from(JSON.stringify(data)),
            { persistent: true }
        );
        console.log(`Повідомлення відправлено до черги ${queueName}:`, data);
    } catch (err) {
        console.error("Помилка відправки повідомлення:", err);
    }
}

async function consumeFromQueue(queueName, callback) {
    if (!channel) {
        console.error("Канал RabbitMQ не ініціалізовано");
        return;
    }
    
    try {
        await channel.consume(queueName, msg => {
            if (msg !== null) {
                const data = JSON.parse(msg.content.toString());
                callback(data);
                channel.ack(msg);
            }
        });
        console.log(`Споживач запущений для черги ${queueName}`);
    } catch (err) {
        console.error("Помилка споживання з черги:", err);
    }
}

module.exports = {
    initRabbitMQ,
    sendToQueue,
    consumeFromQueue,
    NEWS_QUEUE,
    NOTIFICATION_QUEUE
};