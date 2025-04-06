import {Layer, Path, Rect, Stage, Text, Group, Line} from "react-konva";
import React, {useEffect, useMemo, useRef, useState, useCallback} from "react";
import RoomInfoModal from "./RoomInfoModal.jsx";
import '../BuildingMap.css';
import useStore from './store.jsx';
import RouteMap from "./RouteMap.jsx";

const MAP_DATA_PATH = 'https://staticstorm.ru/map/map_data2';

function BuildingMap({isMapActive}) {
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    // стейты для мобилки
    const [stageScale, setStageScale] = useState(isMobileDevice() ? 0.3 : 0.5);
    const [stageX, setStageX] = useState(isMobileDevice() ? -80 : 250);
    const [stageY, setStageY] = useState(isMobileDevice() ? 0 : -150);

    const [isZooming, setIsZooming] = useState(false);
    const [curLayer, setCurLayer] = useState(0);
    const [layers, setLayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRoom, setSelectedRoom] = useState(null);

    // Store interactions
    const setRoomsForStore = useStore((state) => state.setRooms);
    const fromRoom = useStore((state) => state.fromRoom);
    const toRoom = useStore((state) => state.toRoom);
    const selectedSearchRoom = useStore((state) => state.selectedSearchRoom);
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
            if (!lastCenterRef.current) {
                lastCenterRef.current = getCenter(p1, p2);
                lastDistRef.current = getDistance(p1, p2);
                if (lastDistRef.current === 0) return;
                return;
            }
            const newCenter = getCenter(p1, p2);
            const newDist = getDistance(p1, p2);
            if (lastDistRef.current === 0) {
                lastDistRef.current = newDist;
                if (newDist === 0) return;
            }
            const oldScale = stage.scaleX();
            const pointTo = {
                x: (newCenter.x - stage.x()) / oldScale,
                y: (newCenter.y - stage.y()) / oldScale,
            };
            let scale = oldScale * (newDist / (lastDistRef.current || newDist));
            const minScale = 0.3;
            const maxScale = 3;
            scale = Math.max(minScale, Math.min(scale, maxScale));
            setStageScale(scale);
            const dx = newCenter.x - lastCenterRef.current.x;
            const dy = newCenter.y - lastCenterRef.current.y;
            const newPos = {
                x: newCenter.x - pointTo.x * scale + dx,
                y: newCenter.y - pointTo.y * scale + dy,
            };
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

    // Wheel handler for zooming with mouse
    const handleWheel = useCallback((e) => {
        if (!isMapActive) return;
        e.evt.preventDefault();
        const scaleBy = 1.1;
        const stage = e.target.getStage();
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };
        const direction = e.evt.deltaY > 0 ? -1 : 1;
        const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
        const minScale = 0.4;
        const maxScale = 3;
        const clampedScale = Math.max(minScale, Math.min(newScale, maxScale));
        setStageScale(clampedScale);
        setStageX(pointer.x - mousePointTo.x * clampedScale);
        setStageY(pointer.y - mousePointTo.y * clampedScale);
    }, [isMapActive]);

    const handleDragStart = useCallback((e) => {
        if (!isMapActive || isZooming) {
            e.target.getStage()?.stopDrag(); // Add optional chaining
        }
    }, [isMapActive, isZooming]);

    const handleDragEnd = useCallback((e) => {
        if (!isMapActive || !e.target) return; // Add check for e.target
        setStageX(e.target.x());
        setStageY(e.target.y());
    }, [isMapActive]);


    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        console.log("BuildingMap: Загрузка данных карты...", MAP_DATA_PATH);
        fetch(MAP_DATA_PATH)
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .then((data) => {
                if (!isMounted) return;
                if (!data || !Array.isArray(data.layers)) {
                    throw new Error("Invalid map data structure: 'layers' array not found.");
                }
                console.log("Map data loaded, processing layers...");
                const processedLayers = data.layers.map((layer, index) => ({
                    ...layer,
                    floorIndex: index,
                    rooms: (layer.rooms || []).map(r => ({...r, floorIndex: index})),
                    roads: (layer.roads || []).map(r => ({...r, floorIndex: index})),
                    walls: (layer.walls || []).map(w => ({...w, floorIndex: index})),
                    vectors: (layer.vectors || []).map(v => ({...v, floorIndex: index})),
                }));
                setLayers(processedLayers);
                const allRoomsForStore = processedLayers
                    .flatMap(layer => layer.rooms || [])
                    .filter(item => item.type !== 'stair' && item.name);
                setRoomsForStore(allRoomsForStore);
                console.log(`Processed ${processedLayers.length} layers. Set ${allRoomsForStore.length} rooms in store.`);
                setLoading(false);
            })
            .catch(error => {
                if (!isMounted) return;
                console.error("Error loading/processing map data:", error);
                setLoading(false);
                setLayers([]);
                setRoomsForStore([]);
            });
        return () => {
            isMounted = false;
        };
    }, [MAP_DATA_PATH, setRoomsForStore]); // Зависимость от MAP_DATA_PATH еси она становится динамической


    const handleRoomClick = useCallback((room) => {
        if (!isMapActive) return;
        setSelectedRoom(room);
    }, [isMapActive]);

    const handleTouchRoom = useCallback((e, room) => {
        if (!isMapActive || !e?.evt) return;
        e.evt.preventDefault();
        handleRoomClick(room);
    }, [isMapActive, handleRoomClick]);


    const handleLayerChange = useCallback((layerIndex) => {
        if (!isMapActive || !layers[layerIndex]) return;
        setCurLayer(layerIndex);
        setSelectedRoom(null);
    }, [isMapActive, layers]);

    const handleIconClick = useCallback((icon) => {
        if (!isMapActive || !icon.name) return;
        setSelectedRoom({
            id: icon.id,
            name: icon.name,
            type: "icon",
            floorIndex: icon.floorIndex // я хз мб пригодится потом сделать инфу о том на каком этаже
        });
    }, [isMapActive]);


    const getPathBoundingBox = (data) => {
        if (!data) return null;
        const points = [];
        const commands = data.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi) || [];
        let currentX = 0;
        let currentY = 0;

        commands.forEach((cmd) => {
            const type = cmd[0].toUpperCase();
            const args = (cmd.slice(1).trim().match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g) || []).map(parseFloat);
            let relative = cmd[0] === cmd[0].toLowerCase();

            switch (type) {
                case 'M':
                case 'L':
                    for (let i = 0; i < args.length; i += 2) {
                        if (args.length > i + 1 && !isNaN(args[i]) && !isNaN(args[i + 1])) {
                            currentX = relative && i === 0 ? currentX + args[i] : args[i];
                            currentY = relative && i === 0 ? currentY + args[i + 1] : args[i + 1];
                            points.push({x: currentX, y: currentY});
                        }
                    }
                    break;
                case 'H':
                    for (const arg of args) {
                        if (!isNaN(arg)) {
                            currentX = relative ? currentX + arg : arg;
                            points.push({x: currentX, y: currentY});
                        }
                    }
                    break;
                case 'V':
                    for (const arg of args) {
                        if (!isNaN(arg)) {
                            currentY = relative ? currentY + arg : arg;
                            points.push({x: currentX, y: currentY});
                        }
                    }
                    break;
                case 'Z':
                    break;
                case 'C':
                    if (args.length >= 6 && !isNaN(args[args.length - 2]) && !isNaN(args[args.length - 1])) {
                        currentX = relative ? currentX + args[args.length - 2] : args[args.length - 2];
                        currentY = relative ? currentY + args[args.length - 1] : args[args.length - 1];
                        points.push({x: currentX, y: currentY});
                    }
                    break;
                case 'S':
                case 'Q':
                    if (args.length >= 4 && !isNaN(args[args.length - 2]) && !isNaN(args[args.length - 1])) {
                        currentX = relative ? currentX + args[args.length - 2] : args[args.length - 2];
                        currentY = relative ? currentY + args[args.length - 1] : args[args.length - 1];
                        points.push({x: currentX, y: currentY});
                    }
                    break;
                case 'T':
                    if (args.length >= 2 && !isNaN(args[args.length - 2]) && !isNaN(args[args.length - 1])) {
                        currentX = relative ? currentX + args[args.length - 2] : args[args.length - 2];
                        currentY = relative ? currentY + args[args.length - 1] : args[args.length - 1];
                        points.push({x: currentX, y: currentY});
                    }
                    break;
                case 'A':
                    if (args.length >= 7 && !isNaN(args[args.length - 2]) && !isNaN(args[args.length - 1])) {
                        currentX = relative ? currentX + args[args.length - 2] : args[args.length - 2];
                        currentY = relative ? currentY + args[args.length - 1] : args[args.length - 1];
                        points.push({x: currentX, y: currentY});
                    }
                    break;

                default:
                    break;
            }
            if (type === 'M' || type === 'L') relative = false;
        });
        if (points.length === 0) return null;
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

    //это для центрирования в поиске
    useEffect(() => {
        if (selectedSearchRoom && stageRef.current) {
            console.log("Centering map on search:", selectedSearchRoom);
            const targetLayerIndex = selectedSearchRoom.floorIndex;

            if (targetLayerIndex !== undefined && layers[targetLayerIndex] && curLayer !== targetLayerIndex) {
                console.log(`Switching to floor ${targetLayerIndex} for search result.`);
                setCurLayer(targetLayerIndex);
                setSelectedRoom(null);
            }

            let centerX, centerY;
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

            if (centerX !== undefined && centerY !== undefined && !isNaN(centerX) && !isNaN(centerY)) {
                const desiredScale = 2.0; // Zoom level for searched item
                const stage = stageRef.current;
                const {width: stageWidth, height: stageHeight} = stage.getSize();

                const newX = stageWidth / 2 - centerX * desiredScale;
                const newY = stageHeight / 2 - centerY * desiredScale;

                console.log(`Centering calculation: Center (${centerX.toFixed(1)}, ${centerY.toFixed(1)}), Scale: ${desiredScale}, New Pos: (${newX.toFixed(1)}, ${newY.toFixed(1)})`);

                setStageScale(desiredScale);
                setStageX(newX);
                setStageY(newY);
            } else {
                console.log("Centering calculation failed: Invalid center coordinates.");
            }
        }
    }, [selectedSearchRoom, layers]);


    const currentLayerData = useMemo(() => layers[curLayer] || {
        walls: [],
        roads: [],
        rooms: [],
        vectors: []
    }, [layers, curLayer]);


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

    const renderedRoads = useMemo(() =>
            (currentLayerData.roads?.map(road => {
                if (road.data) {
                    return null;
                } else if (road.x1 !== undefined && road.y1 !== undefined && road.x2 !== undefined && road.y2 !== undefined) {
                    return (<Line
                        key={road.id || `road-${road.x1}-${road.y1}`}
                        points={[road.x1, road.y1, road.x2, road.y2]}
                        stroke={road.stroke || 'transparent'}
                        strokeWidth={road.strokeWidth || 2}
                        listening={false}
                        perfectDrawEnabled={false}
                        shadowForStrokeEnabled={false}
                    />);
                } else {
                    return null;
                }
            }) || []),
        [currentLayerData]
    );

    const renderedIcons = useMemo(() => (
        currentLayerData.vectors?.map((vector) => {
            if (!vector.data || typeof vector.data !== 'string' || !vector.id) return null;

            const isClickable = !!vector.name;

            const hitStrokeSize = isClickable ? 15 : 0;

            return (<Path
                key={`vector-${vector.id}`}
                data={vector.data}
                stroke={vector.stroke || "black"}
                strokeWidth={vector.strokeWidth || 1}
                fill={vector.fill || undefined}
                hitStrokeWidth={hitStrokeSize}
                x={vector.x}
                y={vector.y}
                listening={isClickable}
                onClick={isClickable ? () => handleIconClick(vector) : undefined}
                onTap={isClickable ? (e) => handleTouchRoom(e, vector) : undefined}
                // onTap={isClickable ? (e) => { e.evt.preventDefault(); handleIconClick(vector); } : undefined}
                perfectDrawEnabled={false}
                shadowEnabled={false}
            />);
        })
    ), [currentLayerData, handleIconClick, handleTouchRoom]);


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


    return (
        <>
            <div className="floor-buttons">
                {/* тут теперь динамически в зависимости от того сколько этажей */}
                {layers.map((layer, index) => (
                    <button
                        key={layer.floorIndex ?? index}
                        className={`floor-button ${curLayer === (layer.floorIndex ?? index) ? 'active' : ''}`}
                        onClick={() => handleLayerChange(layer.floorIndex ?? index)}
                        aria-label={`Этаж ${index === 4 ? '0' : index + 1}`}
                    >
                        {index === 4 ? '0' : `${index + 1}`}
                    </button>
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
                    <RouteMap currentFloorIndex={curLayer} mapDataPath={MAP_DATA_PATH}/>
                </Layer>
            </Stage>
            <RoomInfoModal
                room={selectedRoom}
                onClose={() => setSelectedRoom(null)}
            />
        </>
    );
}

export default BuildingMap;