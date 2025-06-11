// src/components/dijkstra.js
import TinyQueue from 'tinyqueue';

export function findShortestPath(graph, nodeCoords, startNodeId, endNodeId) {
    if (!graph.has(startNodeId)) {
        console.error(`[Dijkstra] Стартовый узел '${startNodeId}' не найден в графе.`);
        return null;
    }
    if (!graph.has(endNodeId)) {
        console.error(`[Dijkstra] Конечный узел '${endNodeId}' не найден в графе.`);
        return null;
    }
    if (!nodeCoords.has(startNodeId) || !nodeCoords.has(endNodeId)) {
        console.error(`[Dijkstra] Координаты для узла '${startNodeId}' или '${endNodeId}' не найдены.`);
        return null;
    }

    const distances = new Map();
    const previousNodes = new Map();
    const queue = new TinyQueue([], (a, b) => a.distance - b.distance);

    graph.forEach((_, nodeId) => {
        distances.set(nodeId, Infinity);
        previousNodes.set(nodeId, null);
    });

    distances.set(startNodeId, 0);
    queue.push({nodeId: startNodeId, distance: 0});

    while (queue.length > 0) {
        const {nodeId: currentNodeId, distance: currentDistance} = queue.pop();

        if (currentDistance > distances.get(currentNodeId)) {
            continue;
        }

        if (currentNodeId === endNodeId) {
            break;
        }

        const neighbors = graph.get(currentNodeId);
        if (neighbors) {
            neighbors.forEach((weight, neighborId) => {
                if (!nodeCoords.has(neighborId)) return;
                if (isNaN(weight) || weight < 0) return;
                const distanceToNeighbor = currentDistance + weight;
                if (distanceToNeighbor < distances.get(neighborId)) {
                    distances.set(neighborId, distanceToNeighbor);
                    previousNodes.set(neighborId, currentNodeId);
                    queue.push({nodeId: neighborId, distance: distanceToNeighbor});
                }
            });
        }
    }

    const path = [];
    let current = endNodeId;

    if (distances.get(current) === Infinity) {
        return null;
    }

    while (current !== null) {
        path.unshift(current);
        const previous = previousNodes.get(current);
        if (previous === current) {
            console.error("[Dijkstra] Ошибка восстановления пути: обнаружено зацикливание на узле", current);
            return null;
        }
        current = previous;
        if (path.length > graph.size) {
            console.error("[Dijkstra] Ошибка восстановления пути: превышена максимальная длина пути.");
            return null;
        }
    }

    if (path.length === 0 || path[0] !== startNodeId) {
        return null;
    }

    return path.length > 1 ? path : null;
}


/**
 * НОВАЯ ФУНКЦИЯ: Запускает алгоритм Дейкстры от стартового узла и возвращает
 * карту расстояний до всех достижимых узлов.
 * Это основа для производительного поиска ближайших объектов.
 * @param {Map} graph - Граф смежности.
 * @param {string} startNodeId - ID стартового узла.
 * @returns {{distances: Map<string, number>}} - Объект с картой расстояний.
 */
export function findAllDistances(graph, startNodeId) {
    if (!graph.has(startNodeId)) {
        console.error(`[Dijkstra] Стартовый узел '${startNodeId}' не найден в графе.`);
        return {distances: new Map()};
    }

    const distances = new Map();
    const queue = new TinyQueue([], (a, b) => a.distance - b.distance);

    graph.forEach((_, nodeId) => {
        distances.set(nodeId, Infinity);
    });

    distances.set(startNodeId, 0);
    queue.push({nodeId: startNodeId, distance: 0});

    while (queue.length > 0) {
        const {nodeId: currentNodeId, distance: currentDistance} = queue.pop();

        if (currentDistance > distances.get(currentNodeId)) {
            continue;
        }

        const neighbors = graph.get(currentNodeId);
        if (neighbors) {
            neighbors.forEach((weight, neighborId) => {
                if (isNaN(weight) || weight < 0) return;

                const distanceToNeighbor = currentDistance + weight;

                if (distanceToNeighbor < distances.get(neighborId)) {
                    distances.set(neighborId, distanceToNeighbor);
                    queue.push({nodeId: neighborId, distance: distanceToNeighbor});
                }
            });
        }
    }

    return {distances};
}