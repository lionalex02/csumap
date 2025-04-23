import React, { useState } from 'react';
import '../FeedbackForm.css';
import useStore from "./store.jsx";

function FeedbackForm() {

    const {isFeedbackFormOpen, setIsFeedbackFormOpen} =  useStore();
    const [emailOrTelegram, setEmailOrTelegram] = useState('');
    const [message, setMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Подготовка данных для отправки
        const feedbackData = {
            contact: emailOrTelegram || null, // Если поле пустое, отправляем null
            content: message,
        };

        try {
            // Отправка POST-запроса
            const response = await fetch('https://staticstorm.ru/fb/saveFeedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(feedbackData),
            });


            if (!response.ok) {
                throw new Error(`Ошибка сервера: ${response.status}`);
            }

        } catch (error) {
            // Обработка ошибок
            console.error('Ошибка при отправке:', error);
        } finally {

            setEmailOrTelegram('');
            setMessage('');
            setIsFeedbackFormOpen(false);
        }
    };

    const handleClose = () => {
        setIsFeedbackFormOpen(false);
    };

    if (!isFeedbackFormOpen) return null;

    return (
        <div className="feedback-modal-overlay" onClick={handleClose}>
            <div className="feedback-modal-content" onClick={(e) => e.stopPropagation()}>
                {/* Кнопка закрытия */}
                <button
                    className="close-button"
                    onClick={handleClose}
                    aria-label="Закрыть"
                >
                    <span className="close-x">×</span>
                </button>

                {/* Заголовок */}
                <h2>Обратная связь</h2>

                {/* Форма */}
                <form onSubmit={handleSubmit} className="feedback-form">
                    <label htmlFor="emailOrTelegram" className="feedback-label">
                        Email или Telegram (необязательно):
                    </label>
                    <input
                        type="text"
                        id="emailOrTelegram"
                        value={emailOrTelegram}
                        onChange={(e) => setEmailOrTelegram(e.target.value)}
                        placeholder="Введите email или telegram"
                        className="feedback-input"
                    />

                    <label htmlFor="message" className="feedback-label">
                        Ваше сообщение:
                    </label>
                    <textarea
                        id="message"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Введите ваше сообщение"
                        required
                        className="feedback-textarea"
                    />

                    <button type="submit" className="feedback-submit">
                        Отправить
                    </button>
                </form>
            </div>
        </div>
    );
}

export default FeedbackForm;