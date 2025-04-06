// src/components/RouteMap.jsx
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Shape, Text } from 'react-konva';
import useStore from './store.jsx'; // Убедись, что путь правильный
import { buildGraph } from './graph.js'; // Убедись, что путь правильный
import { findShortestPath } from './dijkstra.js'; // Убедись, что путь правильный

// Флаг для детального логирования (true для отладки, false для продакшена)
const DETAILED_DEBUG = false;


function getPathWeight(graph, path) {
    if (!graph || !path || !Array.isArray(path) || path.length < 2) return Infinity;
    let totalWeight = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const u = path[i]; const v = path[i + 1];
        const neighborsOfU = graph.get(u);
        const edgeWeight = neighborsOfU instanceof Map ? neighborsOfU.get(v) : undefined;
        if (edgeWeight === undefined || isNaN(edgeWeight) || edgeWeight < 0) {
            console.error(`[getPathWeight] ПРОБЛЕМА С РЕБРОМ: ${u} -> ${v}. Вес: ${edgeWeight}.`);
            return Infinity;
        }
        totalWeight += edgeWeight;
    }
    if (DETAILED_DEBUG) console.log('[getPathWeight] Итоговый вес:', totalWeight);
    return totalWeight;
}

// Получение точки на полилинии на заданной дистанции
function getPointAtDistance(points, distance) {
    if (!points || points.length < 2) return null;
    if (typeof distance !== 'number' || isNaN(distance) || distance < 0) return null;
    if (distance <= 1e-6) return points[0] ? { ...points[0], segmentIndex: 0 } : null;

    let cumulativeLength = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i]; const p2 = points[i + 1];
        if (!p1 || !p2 || typeof p1.x !== 'number' || typeof p1.y !== 'number' || typeof p2.x !== 'number' || typeof p2.y !== 'number') continue;
        const dx = p2.x - p1.x; const dy = p2.y - p1.y;
        const segmentLength = Math.sqrt(dx * dx + dy * dy);
        if (segmentLength < 1e-6) continue;
        if (cumulativeLength + segmentLength >= distance - 1e-6) {
            const remainingDistance = distance - cumulativeLength;
            const clampedRemaining = Math.max(0, Math.min(remainingDistance, segmentLength));
            const ratio = clampedRemaining / segmentLength;
            if (isNaN(ratio) || !isFinite(ratio)) return points[i] ? { ...points[i], segmentIndex: i } : null;
            const x = p1.x + dx * ratio; const y = p1.y + dy * ratio;
            if (isNaN(x) || isNaN(y)) return points[i] ? { ...points[i], segmentIndex: i } : null;
            return { x, y, segmentIndex: i };
        }
        cumulativeLength += segmentLength;
    }
    const lastPoint = points[points.length - 1];
    return lastPoint ? { ...lastPoint, segmentIndex: points.length - 2 } : null;
}


// --- Основной компонент ---

function RouteMap({ currentFloorIndex, mapDataPath = "https://staticstorm.ru/map/map_data2" }) {
    if (DETAILED_DEBUG) console.log(`%c[RouteMap Render (WITH TRIGGER)] Floor: ${currentFloorIndex}`, 'color: orange; font-weight: bold;');

    // Состояния компонента
    const [graphData, setGraphData] = useState({ graph: null, nodeCoords: null });
    const [calculatedPath, setCalculatedPath] = useState(null);
    const [isLoadingGraph, setIsLoadingGraph] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);

    // Zustand state/actions
    const buildRouteTrigger = useStore((state) => state.buildRouteTrigger);

    // Ref для отслеживания обработанного триггера
    const processedTriggerRef = useRef(null);

    // --- Логирование изменений состояния (для отладки) ---
    useEffect(() => { if (DETAILED_DEBUG) console.log(`%c[RM State] isLoadingGraph: ${isLoadingGraph}`, 'color: #aaa;'); }, [isLoadingGraph]);
    useEffect(() => { if (DETAILED_DEBUG) console.log(`%c[RM State] calculatedPath: ${calculatedPath ? `[...${calculatedPath.length}]` : 'null'}`, 'color: #aaa;'); }, [calculatedPath]);
    useEffect(() => { if (DETAILED_DEBUG) console.log(`%c[RM State] errorMsg: ${errorMsg ? `'${errorMsg}'` : 'null'}`, 'color: red;'); }, [errorMsg]);
    useEffect(() => { if (DETAILED_DEBUG) console.log(`%c[RM State] buildRouteTrigger changed: ${buildRouteTrigger}`, 'color: magenta;'); }, [buildRouteTrigger]);
    useEffect(() => { if (DETAILED_DEBUG) console.log(`%c[RM State] graphData updated: Nodes ${graphData.nodeCoords?.size ?? 'null'}`, 'color: green;'); }, [graphData]);

    // --- Функция получения ID узла графа ---
    const getGraphNodeId = useCallback((item, nodeCoordsMap, localSetErrorMsg) => {
        if (!item || typeof item !== 'object' || item.id === undefined || item.id === null) { console.warn("[getGraphNodeId] Invalid item:", item); return null; }
        if (!nodeCoordsMap || !(nodeCoordsMap instanceof Map) || nodeCoordsMap.size === 0) { console.error("[getGraphNodeId] nodeCoordsMap invalid."); localSetErrorMsg("Ошибка карты: Координаты не готовы."); return null; }

        const { id, type, floorIndex, name } = item;
        const expectedNodeIdBase = `icon-${id}`;
        if (DETAILED_DEBUG) console.log(`[getGraphNodeId] Search: id='${id}', type='${type}', floor=${floorIndex}. Base expecting: '${expectedNodeIdBase}'`);

        try {
            // Комнаты
            if (type === 'room' || type === 'vectorized_room') {
                const doorNodeId = `${expectedNodeIdBase}_door`;
                if (nodeCoordsMap.has(doorNodeId) && nodeCoordsMap.get(doorNodeId)?.floorIndex === floorIndex) return doorNodeId;
                if (nodeCoordsMap.has(expectedNodeIdBase) && nodeCoordsMap.get(expectedNodeIdBase)?.floorIndex === floorIndex) return expectedNodeIdBase;
                const prefixDoorFallbackId = Array.from(nodeCoordsMap.keys()).find(key => key.startsWith(expectedNodeIdBase + "_") && nodeCoordsMap.get(key)?.floorIndex === floorIndex);
                if (prefixDoorFallbackId) return prefixDoorFallbackId;
                localSetErrorMsg(`Нет точки входа для '${name || id}'.`); return null;
            }
            // Иконки
            else if (type === 'icon') {
                if (nodeCoordsMap.has(expectedNodeIdBase) && nodeCoordsMap.get(expectedNodeIdBase)?.floorIndex === floorIndex) return expectedNodeIdBase;
                const prefixFallbackId = Array.from(nodeCoordsMap.keys()).find(key => key.startsWith(expectedNodeIdBase) && nodeCoordsMap.get(key)?.floorIndex === floorIndex);
                if (prefixFallbackId) return prefixFallbackId;
                localSetErrorMsg(`Точка '${name || id}' не найдена.`); return null;
            }
            // Лестницы
            else if (type === 'stair') {
                const match = String(id).match(/^ladder(\d+)/); if (!match) { localSetErrorMsg(`ID лестницы '${id}'?`); return null; }
                const logicalId = match[1], prefix = `icon-ladder${logicalId}_`;
                const stairId = Array.from(nodeCoordsMap.keys()).find(k => k.startsWith(prefix) && nodeCoordsMap.get(k)?.floorIndex === floorIndex); if (stairId) return stairId;
                const anyStairId = Array.from(nodeCoordsMap.keys()).find(k => k.startsWith(prefix)); if (anyStairId) return anyStairId;
                localSetErrorMsg(`Лестница '${name || id}' не найдена.`); return null;
            }
            // Неизвестный тип
            else { localSetErrorMsg(`Неизвестный тип точки: '${type}'`); return null; }
        } catch (err) { console.error("[getGraphNodeId] Error:", err); localSetErrorMsg("Ошибка поиска узла."); return null; }
    }, []);

    // --- Эффект загрузки графа ---
    useEffect(() => {
        console.log("%c[RM Effect Load] Загрузка графа...", 'color: purple;');
        setIsLoadingGraph(true); setErrorMsg(null); setCalculatedPath(null);
        let isMounted = true;
        fetch(mapDataPath)
            .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
            .then(data => { if (!isMounted) return; if (!data?.layers) throw new Error("Нет data.layers"); const pLayers = data.layers.map((l, i) => ({ ...l, floorIndex: i })); console.time("buildGraph"); const { graph, nodeCoords } = buildGraph(pLayers); console.timeEnd("buildGraph"); if (!(graph?.size > 0) || !(nodeCoords?.size > 0)) throw new Error("Граф пуст."); setGraphData({ graph, nodeCoords }); })
            .catch(error => { if (!isMounted) return; console.error("[RM Effect Load] Error:", error); setErrorMsg(`Ошибка данных: ${error.message}`); setGraphData({ graph: null, nodeCoords: null }); })
            .finally(() => { if (!isMounted) return; processedTriggerRef.current = null; setIsLoadingGraph(false); console.log("%c[RM Effect Load] Загрузка завершена.", 'color: purple;'); });
        return () => { isMounted = false; };
    }, [mapDataPath]);

    // --- Эффект расчета пути по триггеру ---
    useEffect(() => {
        if (DETAILED_DEBUG) console.log("%c[RM Effect Path (WITH TRIGGER)] Проверка триггера...", 'color: orange;');
        if (isLoadingGraph) return; // Ждем граф
        if (buildRouteTrigger === null) { // Триггер не активен
            if (calculatedPath) setCalculatedPath(null); if (errorMsg) setErrorMsg(null);
            processedTriggerRef.current = null; return;
        }
        if (processedTriggerRef.current === buildRouteTrigger) return; // Триггер уже обработан

        if (!graphData.graph || !graphData.nodeCoords || graphData.nodeCoords.size === 0) { // Данные графа не готовы
            setErrorMsg("Ошибка карты: Данные для маршрута не готовы.");
            setCalculatedPath(null); processedTriggerRef.current = buildRouteTrigger; return;
        }

        // Начинаем обработку
        console.log(`%c[RM Effect Path] Обработка триггера ${buildRouteTrigger}...`, 'color: #1a73e8; font-weight: bold;');
        setCalculatedPath(null); setErrorMsg(null);


        const currentFromItem = useStore.getState().fromRoom;
        const currentToItem = useStore.getState().toRoom;
        const { graph, nodeCoords } = graphData;

        if (!currentFromItem || !currentToItem) { // Точки не выбраны
           // setErrorMsg("Выберите начальную и конечную точки.");
            processedTriggerRef.current = buildRouteTrigger; return;
        }
        if (currentFromItem.id === currentToItem.id) { // Точки совпадают
          //  setErrorMsg("Начало и конец маршрута совпадают.");
            processedTriggerRef.current = buildRouteTrigger; return;
        }

        // Получаем ID узлов
        const startNodeId = getGraphNodeId(currentFromItem, nodeCoords);
        const endNodeId = getGraphNodeId(currentToItem, nodeCoords);



        // Вызов Дейкстры
        console.time(`Dijkstra ${startNodeId}->${endNodeId}`);
        try {
            const finalPath = findShortestPath(graph, nodeCoords, startNodeId, endNodeId);
            console.log(`[RM Effect Path] Dijkstra Result (finalPath):`, finalPath); // Лог результата

            if (!finalPath || !Array.isArray(finalPath) || finalPath.length < 2) {
                setErrorMsg("Маршрут не найден."); setCalculatedPath(null);
            } else {
                const weight = getPathWeight(graph, finalPath); // Проверяем вес
                if(weight === Infinity) {
                    setErrorMsg("Ошибка расчета маршрута (разрыв)."); setCalculatedPath(null);
                } else {
                    if (DETAILED_DEBUG) console.log(`[RM Effect Path] УСПЕХ! Путь найден (${finalPath.length} узлов), вес: ${weight.toFixed(1)}`);
                    setCalculatedPath(finalPath); // Устанавливаем путь
                    setErrorMsg(null);
                }
            }
        } catch (dijkstraError) {
            console.error("[RM Effect Path] Ошибка Дейкстры:", dijkstraError);
            setErrorMsg(`Ошибка поиска пути: ${dijkstraError.message}`);
            setCalculatedPath(null);
        } finally {
            console.timeEnd(`Dijkstra ${startNodeId}->${endNodeId}`);
            processedTriggerRef.current = buildRouteTrigger; // Помечаем обработанным
        }
    }, [graphData, isLoadingGraph, buildRouteTrigger, getGraphNodeId]); // Зависимости


// --- Мемоизация рендеринга шевронов ---
    const renderedPathChevrons = useMemo(() => {
        const startMemoTime = performance.now();
        if (DETAILED_DEBUG) console.log('%c[RM Memo Chevrons] Запуск...', 'color: #2a9d8f;');

        if (errorMsg || !calculatedPath || calculatedPath.length < 2) return [];
        const nodeCoords = graphData.nodeCoords;
        if (!nodeCoords || nodeCoords.size === 0) return [];

        // Константы стиля
        // const CHEVRON_COLOR = 'red'; // Закомментирована, так как цвет задается напрямую
        const CHEVRON_SIZE = 8;
        const CHEVRON_ANGLE_DEG = 50;
        const CHEVRON_SPACING = 15;
        const CHEVRON_STROKE_WIDTH = 5; // Увеличена толщина линии
        const MIN_SEGMENT_PART_LENGTH = 1e-3;
        const CHEVRON_ANGLE_RAD = CHEVRON_ANGLE_DEG * (Math.PI / 180);

        // Шаг 1: Сборка сегментов
        const pathPointsOnFloor = calculatedPath.map(id => {
            const d = nodeCoords.get(id);
            return (d?.floorIndex === currentFloorIndex && typeof d.x === 'number') ? { x: d.x, y: d.y } : null;
        });
        const continuousSegmentsOnFloor = [];
        let currentSegmentPoints = [];
        for (const p of pathPointsOnFloor) {
            if (p) currentSegmentPoints.push(p);
            else {
                if (currentSegmentPoints.length >= 2) continuousSegmentsOnFloor.push([...currentSegmentPoints]);
                currentSegmentPoints = [];
            }
        }
        if (currentSegmentPoints.length >= 2) continuousSegmentsOnFloor.push([...currentSegmentPoints]);
        if (DETAILED_DEBUG) console.log(`[RM Memo Chevrons] Шаг 1: Найдено сегментов: ${continuousSegmentsOnFloor.length}`);

        // Шаг 2: Отрисовка
        const allChevrons = [];
        let firstChevronLogged = false;
        continuousSegmentsOnFloor.forEach((points, segmentIndex) => {
            let totalLength = 0;
            const partLengths = [];
            try {
                for (let j = 0; j < points.length - 1; j++) {
                    const p1 = points[j], p2 = points[j + 1];
                    if (!p1 || !p2) continue;
                    const len = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
                    const vLen = len >= MIN_SEGMENT_PART_LENGTH ? len : 0;
                    partLengths.push(vLen);
                    totalLength += vLen;
                }
            } catch (e) {
                console.error(`[RM Memo Chevrons] Ошибка при расчете длины сегмента ${segmentIndex}:`, e);
            }
            if (totalLength < MIN_SEGMENT_PART_LENGTH) return;
            if (DETAILED_DEBUG) console.log(`[RM Memo Chevrons] Сегмент ${segmentIndex}: Длина ${totalLength.toFixed(1)}, Генерация...`);

            let currentDistance = CHEVRON_SPACING / 2;
            let chevronsInSegment = 0;

            while (currentDistance < totalLength) {
                const tipPointData = getPointAtDistance(points, currentDistance);
                if (!tipPointData || isNaN(tipPointData.x) || tipPointData.segmentIndex === undefined) {
                    currentDistance += CHEVRON_SPACING;
                    continue;
                }
                const tipPoint = { x: tipPointData.x, y: tipPointData.y };
                const segIdx = tipPointData.segmentIndex;
                if (segIdx < 0 || segIdx >= partLengths.length) {
                    currentDistance += CHEVRON_SPACING;
                    continue;
                }
                const pS = points[segIdx], pE = points[segIdx + 1];
                const segLen = partLengths[segIdx];
                if (!pS || !pE || segLen < 1e-6) {
                    currentDistance += CHEVRON_SPACING;
                    continue;
                }
                const dx = pE.x - pS.x, dy = pE.y - pS.y;
                const ux = dx / segLen, uy = dy / segLen;
                if (isNaN(ux) || !isFinite(ux)) {
                    currentDistance += CHEVRON_SPACING;
                    continue;
                }
                const angle = Math.atan2(uy, ux);
                const a1 = angle - CHEVRON_ANGLE_RAD / 2;
                const a2 = angle + CHEVRON_ANGLE_RAD / 2;
                const bp1 = { x: tipPoint.x - CHEVRON_SIZE * Math.cos(a1), y: tipPoint.y - CHEVRON_SIZE * Math.sin(a1) };
                const bp2 = { x: tipPoint.x - CHEVRON_SIZE * Math.cos(a2), y: tipPoint.y - CHEVRON_SIZE * Math.sin(a2) };
                if (isNaN(bp1.x) || isNaN(bp2.x)) {
                    currentDistance += CHEVRON_SPACING;
                    continue;
                }

                if (!firstChevronLogged && DETAILED_DEBUG) {
                    console.log(`[RM Memo Chevrons] Координаты первого шеврона: tip=(${tipPoint.x.toFixed(1)}, ${tipPoint.y.toFixed(1)})`);
                    firstChevronLogged = true;
                }

                allChevrons.push(
                    <Shape
                        key={`c-s${segmentIndex}-d${currentDistance.toFixed(0)}`}
                        sceneFunc={(ctx) => {
                            // !!! ЗАДАЕМ СТИЛЬ ПРЯМО ЗДЕСЬ !!!
                            ctx.strokeStyle = "red"; // Попробуем зеленый
                            ctx.lineWidth = 2.5;        // И еще толще
                            ctx.lineCap = "round";
                            ctx.lineJoin = "round";
                            // ---------------------------------
                            ctx.beginPath();
                            ctx.moveTo(bp1.x, bp1.y);
                            ctx.lineTo(tipPoint.x, tipPoint.y);
                            ctx.lineTo(bp2.x, bp2.y);
                            ctx.stroke();
                        }}
                        // Уберем пропсы стиля отсюда, раз задаем в sceneFunc
                        // stroke={"blue"}
                        // strokeWidth={CHEVRON_STROKE_WIDTH}
                        // lineCap="round"
                        // lineJoin="round"
                        listening={false}
                        perfectDrawEnabled={false}
                    />
                );
                chevronsInSegment++;
                currentDistance += CHEVRON_SPACING;
            }
            if (DETAILED_DEBUG) console.log(`[RM Memo Chevrons] Сегмент ${segmentIndex}: Сгенерировано ${chevronsInSegment} шевронов`);
        });

        const duration = performance.now() - startMemoTime;
        if (DETAILED_DEBUG) console.log(`%c[RM Memo Chevrons] Завершение (${duration.toFixed(1)}ms). Итого шевронов: ${allChevrons.length}`, 'color: #2a9d8f; font-weight: bold;');
        return allChevrons;
    }, [calculatedPath, graphData.nodeCoords, currentFloorIndex, errorMsg]);


    // --- Финальный рендер компонента ---
    if (isLoadingGraph) return null; // Не рендерим, пока грузится
    if (errorMsg) {
        // Показываем ошибку
        return ( <Text x={20} y={50} text={`Ошибка маршрута: ${errorMsg}`} fill="darkred" fontSize={14} fontStyle="bold" listening={false} wrap="char" width={window.innerWidth ? window.innerWidth - 40 : 400} /> );
    }
    // Рендерим шевроны (или пустой фрагмент, если их нет)
    return <>{renderedPathChevrons}</>;
}

export default RouteMap;