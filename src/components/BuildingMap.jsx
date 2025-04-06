// src/components/BuildingMap.jsx
import { Layer, Path, Rect, Stage, Text, Group, Line, Circle } from "react-konva";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import RoomInfoModal from "./RoomInfoModal.jsx";
import '../BuildingMap.css';
import useStore from './store.jsx';
import RouteMap from "./RouteMap.jsx";

const MAP_DATA_URL = 'https://staticstorm.ru/map/map_data2';
const DETAILED_LOGGING = false;
const DETAILED_DEBUG = false; // Добавляем константу для проверки

function BuildingMap({ isMapActive }) {
    if (DETAILED_LOGGING) console.log(`%c[BuildingMap Render Start] Props: isMapActive=${isMapActive}`, 'color: blue; font-weight: bold;');
    // стейты для мобилки
    const isMobileDevice = useCallback(() => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent), []);
    const [stageScale, setStageScale] = useState(() => isMobileDevice() ? 0.3 : 0.5);
    const [stageX, setStageX] = useState(() => isMobileDevice() ? -80 : 250);
    const [stageY, setStageY] = useState(() => isMobileDevice() ? 0 : -150);
    const [isZooming, setIsZooming] = useState(false);
    const [curLayer, setCurLayer] = useState(0);
    const [layers, setLayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [selectedRoom, setSelectedRoom] = useState(null);

    // Store interactions
    const setRoomsForStore = useStore((state) => state.setRooms);
    const fromRoom = useStore((state) => state.fromRoom);
    const toRoom = useStore((state) => state.toRoom);
    const selectedSearchRoom = useStore((state) => state.selectedSearchRoom);
    const setSelectedSearchRoomAction = useStore((state) => state.setSelectedSearchRoom);
    const selectedBuilding = useStore((state) => state.selectedBuilding);
    const lastCenterRef = useRef(null);
    const lastDistRef = useRef(0);
    const stageRef = useRef(null);

    // useEffect для смены зданий
    useEffect(() => {
        console.log("Selected building changed in store:", selectedBuilding);
        // TODO: Добавить загрузку карт на основе selectedBuilding.id
        // Например тута:
        // - поменять MAP_DATA_PATH на другого здания
        // а пока тока лог
        if (selectedBuilding) {
            // тута то что мб по разному будет строиться новая жжсонка
            const defaultFloorForBuilding = 0;
            setCurLayer(defaultFloorForBuilding);
        }

    }, [selectedBuilding]);


    // ... (keep existing utility functions: getCenter, getDistance)
    const getCenter = (p1, p2) => ({x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2});
    const getDistance = (p1, p2) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

    const handleMultiTouch = useCallback((e) => {
        if (!isMapActive) return;
        e.evt.preventDefault();
        const touch1 = e.evt.touches[0];
        const touch2 = e.evt.touches[1];
        const stage = e.target.getStage();
        if (touch1 && touch2 && stage) {
            if (!isZooming) {
                stage.stopDrag();
                setIsZooming(true);
            }
            const p1 = {x: touch1.clientX, y: touch1.clientY};
            const p2 = {x: touch2.clientX, y: touch2.clientY};
            const newCenter = getCenter(p1, p2);
            const newDist = getDistance(p1, p2);
            if (!lastCenterRef.current) {
                lastCenterRef.current = newCenter;
                lastDistRef.current = newDist;
                return;
            }
            if (newDist === 0) return;
            const oldScale = stage.scaleX();
            const pointTo = { x: (newCenter.x - stage.x()) / oldScale, y: (newCenter.y - stage.y()) / oldScale };
            let scale = oldScale * (newDist / lastDistRef.current);
            scale = Math.max(0.3, Math.min(scale, 3));
            setStageScale(scale);
            const dx = newCenter.x - lastCenterRef.current.x;
            const dy = newCenter.y - lastCenterRef.current.y;
            const newPos = { x: newCenter.x - pointTo.x * scale + dx, y: newCenter.y - pointTo.y * scale + dy };
            setStageX(newPos.x);
            setStageY(newPos.y);
            lastDistRef.current = newDist;
            lastCenterRef.current = newCenter;
        }
    }, [isMapActive, isZooming]);

    const multiTouchEnd = useCallback(() => {
        lastCenterRef.current = null;
        lastDistRef.current = 0;
        setIsZooming(false);
    }, []);

    const handleWheel = useCallback((e) => {
        if (!isMapActive) return;
        e.evt.preventDefault();
        const scaleBy = 1.1;
        const stage = e.target.getStage();
        if (!stage) return;
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
        const direction = e.evt.deltaY > 0 ? -1 : 1;
        let newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
        const clampedScale = Math.max(0.4, Math.min(newScale, 3));
        setStageScale(clampedScale);
        setStageX(pointer.x - mousePointTo.x * clampedScale);
        setStageY(pointer.y - mousePointTo.y * clampedScale);
    }, [isMapActive]);

    const handleDragStart = useCallback((e) => {
        if (!isMapActive || isZooming) e.target?.getStage()?.stopDrag();
    }, [isMapActive, isZooming]);

    const handleDragEnd = useCallback((e) => {
        if (!isMapActive || !e?.target) return;
        setStageX(e.target.x());
        setStageY(e.target.y());
    }, [isMapActive]);

    useEffect(() => {
        let isMounted = true;
        console.log("%c[BM Load Effect] Загрузка данных карты...", 'color: teal; font-weight: bold;');
        setLoading(true);
        setLoadError(null);
        fetch(MAP_DATA_URL)
            .then(response => {
                if (!response.ok) return response.text().then(text => { throw new Error(`HTTP ${response.status}: ${text.slice(0,100)}`); });
                return response.json().catch(err => { throw new Error(`JSON Parse Error: ${err.message}`); });
            })
            .then(data => {
                if (!isMounted) return;
                if (!data || !Array.isArray(data.layers)) throw new Error("Invalid map data structure.");
                console.log("Map data loaded, processing layers...");
                const processedLayers = data.layers.map((layer, index) => {
                    if (!layer || typeof layer !== 'object') return null;
                    const floorIndex = index;
                    return {
                        ...layer,
                        floorIndex: floorIndex,
                        rooms: (Array.isArray(layer.rooms) ? layer.rooms : []).map(r => r ? { ...r, floorIndex: floorIndex, type: r.type || (r.data ? 'vectorized_room' : 'room') } : null).filter(Boolean),
                        roads: (Array.isArray(layer.roads) ? layer.roads : []).map(r => r ? { ...r, floorIndex: floorIndex } : null).filter(Boolean),
                        walls: (Array.isArray(layer.walls) ? layer.walls : []).map(w => w ? { ...w, floorIndex: floorIndex } : null).filter(Boolean),
                        vectors: (Array.isArray(layer.vectors) ? layer.vectors : []).map(v => v ? { ...v, floorIndex: floorIndex, type: v.type || 'icon' } : null).filter(Boolean),
                    };
                }).filter(Boolean);
                setLayers(processedLayers);
                const allRoomsForStore = processedLayers
                    .flatMap(layer => [...(layer.rooms || []), ...(layer.vectors || []).filter(v => v.type === 'icon' && v.name)])
                    .filter(item => item && item.id && item.type !== 'stair' && item.name)
                    .map(item => ({ id: item.id, name: item.name, description: item.description, floorIndex: item.floorIndex, type: item.type, ...(item.x !== undefined && { x: item.x }), ...(item.y !== undefined && { y: item.y }), ...(item.width !== undefined && { width: item.width }), ...(item.height !== undefined && { height: item.height }), ...(item.data && typeof item.data === 'string' && { data: item.data }) }));
                const uniqueRoomsForStore = Array.from(new Map(allRoomsForStore.map(item => [item.id, item])).values());
                setRoomsForStore(uniqueRoomsForStore);
                if (DETAILED_DEBUG) {
                    const securityItem = uniqueRoomsForStore.find(item => item.id === 'security');
                    console.log('[BM Load Effect] Check security item in store:', securityItem);
                    const r131Item = uniqueRoomsForStore.find(item => item.id === 'r131');
                    console.log('[BM Load Effect] Check r131 item in store:', r131Item);
                }
                console.log(`%c[BM Load Effect] Загружено: ${processedLayers.length} слоев, ${uniqueRoomsForStore.length} объектов для стора.`, 'color: teal');
                console.log(`Processed ${processedLayers.length} layers. Set ${allRoomsForStore.length} rooms in store.`);
                setLoading(false);
                setLoadError(null);
            })
            .catch(error => {
                if (!isMounted) return;
                console.error("[BM Load Effect] Ошибка:", error);
                setLoadError(error.message || "Неизвестная ошибка загрузки карты.");
                setLoading(false);
                setLayers([]);
                setRoomsForStore([]);
            });
        return () => {
            isMounted = false;
        };
    }, [MAP_DATA_PATH, setRoomsForStore]); // Зависимость от MAP_DATA_PATH еси она становится динамической


    const handleRoomClick = useCallback((room) => {
        if (!isMapActive || !room || typeof room !== 'object') return;
        if (DETAILED_LOGGING) console.log('[BM RoomClick]', room);
        setSelectedRoom(room);
    }, [isMapActive]);

    const handleTouchRoom = useCallback((e, room) => {
        if (!isMapActive || !e?.evt) return;
        e.evt.preventDefault();
        handleRoomClick(room);
    }, [isMapActive, handleRoomClick]);

    const handleIconClick = useCallback((icon) => {
        if (!isMapActive || !icon || typeof icon !== 'object' || !icon.name) return;
        if (DETAILED_LOGGING) console.log('[BM IconClick]', icon);
        setSelectedRoom({
            id: icon.id,
            name: icon.name,
            type: "icon",
            floorIndex: icon.floorIndex,
            x: icon.x,
            y: icon.y
        });
    }, [isMapActive]);

    const handleLayerChange = useCallback((layerIndex) => {
        if (!isMapActive || loading || !Array.isArray(layers) || !layers[layerIndex] || curLayer === layerIndex) return;
        console.log(`[BM LayerChange] Переключение на этаж ${layerIndex}`);
        setCurLayer(layerIndex);

        //setSelectedRoom(null);

    }, [isMapActive, loading, layers, curLayer]);

    const getPathBoundingBox = useCallback((data) => {
        if (!data || typeof data !== 'string') return null;
        const points = [];
        const commands = data.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi) || [];
        let currentX = 0, currentY = 0, startX = 0, startY = 0, firstPoint = true;
        commands.forEach((cmd, cmdIndex) => {
            const type = cmd[0].toUpperCase();
            const isRelative = cmd[0] !== type;
            let args = [];
            try {
                args = (cmd.slice(1).trim().match(/-?\d+(\.\d+)?/g) || []).map(Number).filter(n => !isNaN(n));
                switch (type) {
                    case 'M':
                        for (let i = 0; i < args.length; i += 2) {
                            currentX = isRelative && !firstPoint ? currentX + args[i] : args[i];
                            currentY = isRelative && !firstPoint ? currentY + args[i + 1] : args[i + 1];
                            points.push({ x: currentX, y: currentY });
                            if (i === 0) { startX = currentX; startY = currentY; }
                            firstPoint = false;
                        }
                        break;
                    case 'L': case 'T':
                        for (let i = 0; i < args.length; i += 2) {
                            currentX = isRelative ? currentX + args[i] : args[i];
                            currentY = isRelative ? currentY + args[i + 1] : args[i + 1];
                            points.push({ x: currentX, y: currentY });
                        }
                        break;
                    case 'H':
                        for (let i = 0; i < args.length; i++) {
                            currentX = isRelative ? currentX + args[i] : args[i];
                            points.push({ x: currentX, y: currentY });
                        }
                        break;
                    case 'V':
                        for (let i = 0; i < args.length; i++) {
                            currentY = isRelative ? currentY + args[i] : args[i];
                            points.push({ x: currentX, y: currentY });
                        }
                        break;
                    case 'C':
                        if (args.length >= 6) {
                            currentX = isRelative ? currentX + args[args.length - 2] : args[args.length - 2];
                            currentY = isRelative ? currentY + args[args.length - 1] : args[args.length - 1];
                            points.push({ x: currentX, y: currentY });
                        }
                        break;
                    case 'S': case 'Q':
                        if (args.length >= 4) {
                            currentX = isRelative ? currentX + args[args.length - 2] : args[args.length - 2];
                            currentY = isRelative ? currentY + args[args.length - 1] : args[args.length - 1];
                            points.push({ x: currentX, y: currentY });
                        }
                        break;
                    case 'A':
                        if (args.length >= 7) {
                            currentX = isRelative ? currentX + args[args.length - 2] : args[args.length - 2];
                            currentY = isRelative ? currentY + args[args.length - 1] : args[args.length - 1];
                            points.push({ x: currentX, y: currentY });
                        }
                        break;
                    case 'Z':
                        currentX = startX;
                        currentY = startY;
                        firstPoint = true;
                        break;
                }
            } catch (parseError) {
                console.error(`[getPathBoundingBox] Ошибка парсинга команды #${cmdIndex} ('${cmd}'):`, parseError);
            }
            if (type === 'M' || type === 'L') relative = false;
        });
        if (points.length === 0) return null;
        try {
            const xs = points.map(p => p.x);
            const ys = points.map(p => p.y);
            return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
        } catch (bboxError) {
            console.error('[getPathBoundingBox] Ошибка при вычислении bbox:', bboxError, points);
            return null;
        }
    }, []);
        const xs = points.map(p => p.x).filter(x => !isNaN(x));
        const ys = points.map(p => p.y).filter(y => !isNaN(y));
        if (xs.length === 0 || ys.length === 0) return null;
        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys),
        };
    };

    useEffect(() => {
        if (!selectedSearchRoom?.id) {
            return;
        }

        if (DETAILED_LOGGING) console.log('%c[BM Center Effect] Запуск центрирования на:', 'color: darkcyan; font-weight: bold;', selectedSearchRoom.id);

        const targetLayer = selectedSearchRoom.floorIndex;
        if (targetLayer !== undefined && targetLayer !== curLayer && layers[targetLayer]) {
            if (DETAILED_LOGGING) console.log(`[BM Center Effect] Переключение на этаж ${targetLayer} для центрирования`);
            setCurLayer(targetLayer);
        }

        let centerX, centerY;
        try {
            if (selectedSearchRoom.data && typeof selectedSearchRoom.data === 'string') {
                const bbox = getPathBoundingBox(selectedSearchRoom.data);
                if (bbox) {
                    centerX = bbox.minX + (bbox.maxX - bbox.minX) / 2;
                    centerY = bbox.minY + (bbox.maxY - bbox.minY) / 2;
                } else {
                    console.warn("Could not calculate bounding box for searched room path:", selectedSearchRoom.id);
                    return;
                }
            } else if (selectedSearchRoom.x !== undefined && selectedSearchRoom.y !== undefined) {
                centerX = selectedSearchRoom.x + (selectedSearchRoom.width || 0) / 2;
                centerY = selectedSearchRoom.y + (selectedSearchRoom.height || 0) / 2;
            } else {
                console.warn("Searched room has no valid coordinates or path data:", selectedSearchRoom.id);
                return;
            }
        } catch (centerError) {
            console.error('[BM Center Effect] Ошибка расчета центра:', centerError);
        }

        if (centerX !== undefined && centerY !== undefined && !isNaN(centerX) && !isNaN(centerY)) {
            const scale = 2.0;
            const desiredScale = 2.0; // Zoom level for searched item
            const screenCenterX = window.innerWidth / 2;
            const screenCenterY = window.innerHeight / 2;
            //const stage = stageRef.current;
            //const {width: stageWidth, height: stageHeight} = stage.getSize();
            //const newX = stageWidth / 2 - centerX * desiredScale;
            //const newY = stageHeight / 2 - centerY * desiredScale;

            const newX = screenCenterX - centerX * scale;
            const newY = screenCenterY - centerY * scale;
            if (DETAILED_LOGGING) console.log(`[BM Center Effect] Установка позиции: scale=${scale.toFixed(1)}, x=${newX.toFixed(1)}, y=${newY.toFixed(1)}`);
            setStageScale(scale);
            setStageX(newX);
            setStageY(newY);
        } else {
            console.warn('[BM Center Effect] Не удалось рассчитать центр для', selectedSearchRoom.id);
        }

        if (DETAILED_LOGGING) console.log(`%c[BM Center Effect] Сброс selectedSearchRoom после центрирования`, 'color: darkcyan;');
        setSelectedSearchRoomAction(null);

        if (DETAILED_LOGGING) console.log('%c[BM Center Effect] === ЗАВЕРШЕНИЕ ===', 'color: darkcyan; font-weight: bold;');
    }, [selectedSearchRoom, layers, getPathBoundingBox, setSelectedSearchRoomAction]);

    const currentLayerData = useMemo(() => (
        (Array.isArray(layers) && layers[curLayer])
            ? layers[curLayer]
            : { walls: [],
                roads: [],
                rooms: [],
                vectors: []
        }), [layers, curLayer]);

    const renderedWalls = useMemo(() => {
        const walls = currentLayerData.walls || [];
        return walls.map((wall, index) => {
            if (!wall || typeof wall.data !== 'string') return null;
            const key = `wall-${curLayer}-${wall.id || index}`;
            return <Path
                key={`wall-${curLayer}-${wall.id || index}-${wall.data?.substring(0, 15)}`} // More robust key
                data={wall.data}
                x={wall.x || 0}
                y={wall.y || 0}
                stroke={wall.stroke || "grey"} // тута поярче
                strokeWidth={wall.strokeWidth || 1}
                listening={false}
                perfectDrawEnabled={false}
                shadowForStrokeEnabled={false}
                opacity={0.8} // хз делать нет так
            />;
        }).filter(Boolean);
    }, [currentLayerData.walls, curLayer]);
/*
const renderedWalls = useMemo(() =>
        (currentLayerData.walls?.map((wall, index) => (
            <Path
                key={`wall-${curLayer}-${wall.id || index}-${wall.data?.substring(0, 15)}`} // More robust key
                data={wall.data}
                x={wall.x || 0}
                y={wall.y || 0}
                stroke={wall.stroke || "grey"} // тута поярче
                strokeWidth={wall.strokeWidth || 1}
                listening={false}
                perfectDrawEnabled={false}
                shadowForStrokeEnabled={false}
                opacity={0.8} // хз делать нет так
            />
        )) || []),
    [currentLayerData, curLayer]
);
*/
    //Чуть подправил ))))0

    const renderedRoads = useMemo(() => {
        const roads = currentLayerData.roads || [];
        return roads.map((road, index) => {
            if (!road || typeof road.x1 !== 'number' || typeof road.y1 !== 'number' || typeof road.x2 !== 'number' || typeof road.y2 !== 'number') return null;
            const key = `road-${curLayer}-${road.id || index}`;
            return <Line
                key={key}
                points={[road.x1, road.y1, road.x2, road.y2]}
                stroke={road.stroke || 'transparent'}
                strokeWidth={road.strokeWidth ?? 2}
                listening={false} perfectDrawEnabled={false}
            />;
        }).filter(Boolean);
    }, [currentLayerData.roads, curLayer]);

    const renderedIcons = useMemo(() => {
        const vectors = currentLayerData.vectors || [];
        if (!Array.isArray(vectors)) return [];
        return vectors.map((vector) => {
            if (!vector || !vector.id) return null;
            const iconKey = `vector-${curLayer}-${vector.id}`;
            const isInteractive = !!vector.name;
            const isClickable = !!vector.name;

            const hitStrokeSize = isClickable ? 15 : 0;
            if (vector.data && typeof vector.data === 'string') {
                return (
                    <Path
                        key={iconKey}
                        id={vector.id.toString()}
                        data={vector.data}
                        stroke={vector.stroke || "grey"}
                        strokeWidth={vector.strokeWidth ?? 1}
                        fill={vector.fill}
                        hitStrokeWidth={isInteractive ? 10 : 0}
                        onClick={isInteractive ? () => handleIconClick(vector) : undefined}
                        onTap={isInteractive ? (e) => { e.evt.preventDefault(); handleIconClick(vector); } : undefined}
                        listening={isInteractive}
                        perfectDrawEnabled={false}
                        x={vector.x || 0}
                        y={vector.y || 0}
                    />
                );
            }  else return null;
        }).filter(Boolean);
    }, [currentLayerData.vectors, curLayer, handleIconClick]);

    const renderedRooms = useMemo(() => {
        const rooms = currentLayerData.rooms || [];
        if (!Array.isArray(rooms)) return [];
        return rooms.map((room) => {
            if (!room || !room.id) return null;
            const key = `room-${curLayer}-${room.id}`;
            const isStart = fromRoom?.id === room.id && fromRoom?.floorIndex === curLayer;
            const isEnd = toRoom?.id === room.id && toRoom?.floorIndex === curLayer;
            let fillColor = 'rgba(200, 200, 200, 0.3)';
            if (room.type === 'stair') fillColor = 'rgba(100, 100, 255, 0.6)';
            if (isStart && isEnd) fillColor = 'rgba(255, 165, 0, 0.7)';
            else if (isStart) fillColor = 'rgba(0, 255, 0, 0.5)';
            else if (isEnd) fillColor = 'rgba(255, 0, 0, 0.5)';

            //let fillColor = 'rgba(200, 200, 200, 0.3)';
            //if (room.type === 'stair') fillColor = 'rgba(100, 100, 255 esetben, 0.6)';
            //if (isStartSelected) fillColor = 'rgba(255, 0, 0, 0.4)';
            //if (isEndSelected) fillColor = 'rgba(255, 0, 0, 0.4)';
            //if (isStartSelected && isEndSelected) fillColor = 'rgba(255, 165, 0, 0.7)';

            const posX = room.x ?? 0;
            const posY = room.y ?? 0;
            if (room.type === 'stair') {
                const w = room.width || 15;
                const h = room.height || 15;
                return (
                    <Group key={key} x={posX} y={posY}>
                        <Rect
                            id={room.id.toString()}
                            width={w}
                            height={h}
                            fill={fillColor}
                            stroke="black"
                            strokeWidth={1}
                            onClick={() => handleRoomClick(room)}
                            onTap={(e) => handleTouchRoom(e, room)}
                            perfectDrawEnabled={false}
                            hitStrokeWidth={10}
                        />
                        {room.name && (
                            <Text
                                x={0}
                                y={h / 2 - 5}
                                width={w}
                                height={10}
                                align="center"
                                verticalAlign="middle"
                                text={room.name}
                                fontSize={8}
                                fill="black"
                                listening={false}
                                perfectDrawEnabled={false}
                            />
                        )}
                    </Group>
                );
            } else if (room.data && typeof room.data === 'string') {
                const bbox = getPathBoundingBox(room.data);
                let tx = posX, ty = posY;
                const tw = 60, th = 15;
                if (bbox) {
                    tx = bbox.minX + (bbox.maxX - bbox.minX - tw) / 2;
                    ty = bbox.minY + (bbox.maxY - bbox.minY - th) / 2;
                }
                return (
                    <Group key={key} x={posX} y={posY}>
                        <Path
                            id={room.id.toString()}
                            data={room.data}
                            fill={fillColor}
                            stroke="darkgrey"
                            strokeWidth={0.5}
                            onClick={() => handleRoomClick(room)}
                            onTap={(e) => handleTouchRoom(e, room)}
                            perfectDrawEnabled={false}
                            hitStrokeWidth={5}
                        />
                        {room.name && (
                            <Text
                                x={tx - posX}
                                y={ty - posY}
                                width={tw}
                                height={th}
                                text={room.name}
                                fontSize={9}
                                fill="black"
                                align="center"
                                verticalAlign="middle"
                                listening={false}
                                perfectDrawEnabled={false}
                                wrap="none"
                                ellipsis={true}
                            />
                        )}
                    </Group>
                );
            } else if (room.width !== undefined && room.height !== undefined) {
                const w = room.width;
                const h = room.height;
                return (
                    <Group key={key} x={posX} y={posY}>
                        <Rect
                            id={room.id.toString()}
                            width={w}
                            height={h}
                            fill={fillColor}
                            stroke="darkgrey"
                            strokeWidth={0.5}
                            onClick={() => handleRoomClick(room)}
                            onTap={(e) => handleTouchRoom(e, room)}
                            perfectDrawEnabled={false}
                            hitStrokeWidth={10}
                        />
                        {room.name && (
                            <Text
                                x={w / 2}
                                y={h / 2}
                                width={w * 0.9}
                                height={h * 0.9}
                                offsetX={w * 0.9 / 2}
                                offsetY={h * 0.9 / 2}
                                align={'center'}
                                verticalAlign={'middle'}
                                text={room.name}
                                fontSize={10}
                                fill="black"
                                listening={false}
                                perfectDrawEnabled={false}
                                wrap="char"
                                ellipsis={true}
                            />
                        )}
                    </Group>
                );
            } else return null;
        }).filter(Boolean);
    }, [currentLayerData.rooms, curLayer, fromRoom, toRoom, handleRoomClick, handleTouchRoom, getPathBoundingBox]);
    const renderedRooms = useMemo(() =>
            (currentLayerData.rooms?.map(room => {
                if (!room || !room.id) return null;

                const isSelected = selectedRoom?.id === room.id;
                const isStartSelected = fromRoom?.id === room.id;
                const isEndSelected = toRoom?.id === room.id;

                let baseColor = 'rgba(200, 200, 200, 0.3)';
                let strokeColor = "grey";
                let strokeWidth = 0.5;

                // Specific type styling
                if (room.type === 'stair') {
                    baseColor = 'rgba(180, 180, 255, 0.4)';
                    strokeColor = "darkblue";
                    strokeWidth = 1;
                } else if (room.type === 'technical') {
                    baseColor = 'rgba(210, 210, 210, 0.2)';
                    strokeColor = "#bbb";
                    strokeWidth = 0.5;
                } else if (room.type === 'wc' || room.name?.toLowerCase().includes('туалет')) {
                    baseColor = 'rgba(200, 230, 255, 0.4)';
                }

                // Highlight routing points
                if (isStartSelected && isEndSelected) {
                    baseColor = 'rgba(255, 165, 0, 0.7)';
                    strokeColor = 'darkorange';
                    strokeWidth = 1.5;
                } else if (isStartSelected) {
                    baseColor = 'rgba(255, 0, 0, 0.4)';
                    strokeColor = 'darkred';
                    strokeWidth = 1.5;
                } else if (isEndSelected) {
                    baseColor = 'rgba(255, 0, 0, 0.4)';
                    strokeColor = 'darkred';
                    strokeWidth = 1.5;
                }

                if (isSelected) {
                    strokeColor = '#D6322D';
                    strokeWidth = 2;
                }


                // Common props
                const commonProps = {
                    id: room.id,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    onClick: () => handleRoomClick(room),
                    onTap: (e) => handleTouchRoom(e, room),
                    perfectDrawEnabled: false,
                    shadowEnabled: false,
                    fill: baseColor,
                };

                const textProps = {
                    text: room.name || '',
                    fontSize: room.fontSize || 14,
                    fill: '#333',
                    listening: false,
                    perfectDrawEnabled: false,
                    shadowEnabled: false,
                    align: 'center',
                    verticalAlign: 'middle',
                    fontFamily: "'Nunito', sans-serif",
                    fontOpticalSizing: 'auto',
                    fontWeight: 500,
                    fontStyle: 'normal',
            };


                if (room.data && typeof room.data === 'string') {
                    const bbox = getPathBoundingBox(room.data);
                    if (!bbox) return null;
                    const textWidth = bbox.maxX - bbox.minX - 4;
                    const textHeight = bbox.maxY - bbox.minY - 4;

                    const showText = textWidth > 10 && textHeight > 5;

                    return (
                        <Group key={room.id}>
                            <Path
                                {...commonProps}
                                data={room.data}
                            />
                            {showText && (
                                <Text
                                    {...textProps}
                                    x={bbox.minX + 2}
                                    y={bbox.minY + 2}
                                    width={textWidth}
                                    height={textHeight}
                                    clipFunc={(ctx) => {
                                        const path = new Path2D(room.data);
                                        ctx.clip(path);
                                    }}
                                />
                            )}
                        </Group>
                    );
                } else if (room.x !== undefined && room.y !== undefined && room.width && room.height) {
                    const showText = room.width > 15 && room.height > 8;

                    return (
                        <Group key={room.id}>
                            <Rect
                                {...commonProps}
                                x={room.x}
                                y={room.y}
                                width={room.width}
                                height={room.height}
                            />
                            {showText && (
                                <Text
                                    {...textProps}
                                    x={room.x}
                                    y={room.y}
                                    width={room.width}
                                    height={room.height}
                                />
                            )}
                        </Group>
                    );
                } else {
                    return null;
                }
            }) || []),
        [currentLayerData, curLayer, fromRoom, toRoom, selectedRoom, handleRoomClick, handleTouchRoom]
    );

    if (loading) return <div className="map-status">Загрузка карты...</div>;
    if (loadError) return <div className="map-status error">Ошибка загрузки карты: {loadError}</div>;

/*
    if (loading) {
        return <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '20px',
            color: '#555'
        }}>Загрузка карты...</div>;
    }
    if (!layers || layers.length === 0) {
        return <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '20px',
            color: 'red'
        }}>Ошибка загрузки данных карты.</div>;
    }
*/


    return (
        <>
            <div className="floor-buttons">
                {[4, 0, 1, 2, 3].map(floorIndex => (
                    layers[floorIndex] ? (
                        <button
                            key={`fb-${floorIndex}`}
                            className={`floor-button ${curLayer === floorIndex ? 'active' : ''}`}
                            onClick={() => handleLayerChange(floorIndex)}
                            disabled={!isMapActive || loading}
                            aria-label={`Этаж ${ floorIndex === 4 ? '0' : floorIndex + 1}`}
                        >
                            {floorIndex === 4 ? '0' : `${floorIndex + 1}`}
                        </button>
                    ) : null
                ))}
            </div>
            <Stage
                height={window.innerHeight}
                width={window.innerWidth}
                onWheel={handleWheel}
                onTouchMove={handleMultiTouch}
                onTouchEnd={multiTouchEnd}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                scaleX={stageScale}
                scaleY={stageScale}
                x={stageX}
                y={stageY}
                draggable={isMapActive && !isZooming}
                ref={stageRef}
                style={{background: "#F3F3F4", cursor: isMapActive ? 'grab' : 'default'}}
                onMouseDown={isMapActive ? (e) => e.target.getStage().container().style.cursor = 'grabbing' : undefined}
                onMouseUp={isMapActive ? (e) => e.target.getStage().container().style.cursor = 'grab' : undefined}
            >
                <Layer>
                    {renderedWalls}
                    {renderedRoads}
                    {renderedRooms}
                    {renderedIcons}
                    <RouteMap currentFloorIndex={curLayer} mapDataPath={MAP_DATA_URL}/>
                </Layer>
            </Stage>
            <RoomInfoModal
                room={selectedRoom}
                onClose={() => { setSelectedRoom(null); }}
            />
        </>
    );
}

export default BuildingMap;