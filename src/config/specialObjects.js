// src/config/specialObjects.js

/**
 * Центральный конфигурационный файл для "особых" объектов.
 * Это единственный источник правды о том, какие объекты запускают новый флоу.
 * Ключ к расширяемости: для добавления нового типа объекта (например, "банкомат")
 * достаточно добавить новую запись в этот объект.
 */
export const SPECIAL_OBJECT_CONFIG = {
    'туалет': {
        // Ключевые слова, которые триггерят поиск этого типа объекта
        searchKeywords: ['туалет', 'wc', 'уборная', 'ту', 'туа', 'туал', 'туале'],
        // Идентификатор категории, для поиска в общем списке комнат (rooms).
        targetCategory: 'туалет',
        // Нужно ли отображать панель фильтров?
        isFilterable: true,
        // Описание самих фильтров
        filterProperties: [
            { id: 'male', label: 'М', searchKeyword: 'мужской' }, // Ключевое слово для этого фильтра
            { id: 'female', label: 'Ж', searchKeyword: 'женский' },
            { id: 'accessible', label: 'ИНВ', searchKeyword: 'для лиц с' }, // Уточнено для поиска
        ]
    },
    'фонтанчик': {
        searchKeywords: ['фонтан', 'фонтанчик', 'питьевой'],
        targetCategory: 'фонтанчик',
        isFilterable: false,
    },
    'выход': {
        searchKeywords: ['выход', 'exit', 'вход', 'вы', 'вых', 'выхо', 'вх', 'вхо'],
        targetCategory: 'выход',
        isFilterable: false,
    }
};

/**
 * Хелпер для получения конфига по поисковому запросу.
 * @param {string} query - Поисковый запрос пользователя.
 * @returns {object|null} - Конфиг объекта или null, если не найдено.
 */
export const getSpecialConfigByQuery = (query) => {
    if (!query) return null;
    const lowerCaseQuery = query.toLowerCase();
    for (const key in SPECIAL_OBJECT_CONFIG) {
        const config = SPECIAL_OBJECT_CONFIG[key];
        if (config.searchKeywords.some(keyword => lowerCaseQuery.includes(keyword))) {
            return { ...config, key: key };
        }
    }
    return null;
};