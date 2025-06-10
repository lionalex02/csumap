// src/components/BuildingMap.jsx

import { Layer, Path, Rect, Stage, Text, Group, Line } from "react-konva";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import RoomInfoModal from "./RoomInfoModal.jsx";
import '../BuildingMap.css';
import useStore from './store.jsx';
import RouteMap from "./RouteMap.jsx";

const MAP_DATA_URL = 'https://staticstorm.ru/map/map_data2';
const DETAILED_LOGGING = false;

// --- КОМПОНЕНТ ПЕРЕПИСАН ДЛЯ СТАБИЛЬНОСТИ ---
function BuildingMap({ isMapActive }) {
    if (DETAILED_LOGGING) console.log(`%c[BuildingMap Render]`, 'color: blue; font-weight: bold;');

    const isMobileDevice = useCallback(() => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent), []);
    const [stageScale, setStageScale] = useState(() => isMobileDevice() ? 0.3 : 0.5);
    const [stageX, setStageX] = useState(() => isMobileDevice() ? -80 : 250);
    const [stageY, setStageY] = useState(() => isMobileDevice() ? 0 : -150);
    const [isZooming, setIsZooming] = useState(false);
    const [layers, setLayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [selectedRoom, setSelectedRoom] = useState(null);

    // --- АТОМАРНЫЕ СЕЛЕКТОРЫ ZUSTAND ---
    const currentMapFloor = useStore(state => state.currentMapFloor);
    const fromRoom = useStore(state => state.fromRoom);
    const toRoom = useStore(state => state.toRoom);
    const highlightedObjectIds = useStore(state => state.highlightedObjectIds);
    const selectedSearchRoom = useStore(state => state.selectedSearchRoom);

    const selectedCandidate = useStore(state => {
        const { specialSearch: ss } = state;
        if (ss?.status === 'selection' && ss.candidates.length > 0) {
            return ss.candidates[ss.selectedIndex].room;
        }
        return null;
    });

    const {
        setRooms,
        setCurrentMapFloor,
        setSelectedSearchRoom,
        setFromRoom,
    } = useStore.getState();

    const lastCenterRef = useRef(null);
    const lastDistRef = useRef(0);
    const stageRef = useRef(null);

    // --- ОБРАБОТЧИКИ, ЗАВЕРНУТЫЕ В USECALLBACK С МИНИМАЛЬНЫМИ ЗАВИСИМОСТЯМИ ---
    const handleDragStart = useCallback((e) => {
        if (!isMapActive || isZooming) e.target?.getStage()?.stopDrag();
    }, [isMapActive, isZooming]);

    const handleDragEnd = useCallback((e) => {
        if (!isMapActive || !e?.target) return;
        setStageX(e.target.x());
        setStageY(e.target.y());
    }, [isMapActive]);

    const handleRoomClick = useCallback((room) => {
        if (!isMapActive || !room) return;

        const currentSpecialSearchStatus = useStore.getState().specialSearch?.status;

        if (currentSpecialSearchStatus?.startsWith('pending')) {
            setFromRoom(room);
        } else {
            setSelectedRoom(room);
        }
    }, [isMapActive, setFromRoom]);

    const handleTouchRoom = useCallback((e, room) => {
        e.evt.preventDefault();
        handleRoomClick(room);
    }, [handleRoomClick]);

    const handleIconClick = useCallback((icon) => {
        handleRoomClick({ ...icon });
    }, [handleRoomClick]);

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
            const p1 = { x: touch1.clientX, y: touch1.clientY };
            const p2 = { x: touch2.clientX, y: touch2.clientY };
            const newCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            const newDist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
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

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        setLoadError(null);
        fetch(MAP_DATA_URL)
            .then(res => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
            .then(data => {
                if (!isMounted || !data?.layers) return;
                const processedLayers = data.layers.map((layer, index) => ({
                    ...layer,
                    floorIndex: index,
                    rooms: (layer.rooms || []).map(r => ({ ...r, floorIndex: index, type: r.type || (r.data ? 'vectorized_room' : 'room') })).filter(Boolean),
                    roads: (layer.roads || []).map(r => ({ ...r, floorIndex: index })).filter(Boolean),
                    walls: (layer.walls || []).map(w => ({ ...w, floorIndex: index })).filter(Boolean),
                    vectors: (layer.vectors || []).map(v => ({ ...v, floorIndex: index, type: v.type || 'icon' })).filter(Boolean),
                })).filter(Boolean);
                setLayers(processedLayers);
                const allItems = processedLayers.flatMap(l => [...(l.rooms || []), ...(l.vectors || [])])
                    .filter(item => item?.id && (item.name || item.description));
                setRooms(Array.from(new Map(allItems.map(item => [item.id, item])).values()));
            })
            .catch(error => {
                if (isMounted) setLoadError(error.message);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });
        return () => { isMounted = false; };
    }, [setRooms]);

    const getPathBoundingBox = useCallback((data) => {
        if (!data || typeof data !== 'string') return null;
        const points = [];
        const commands = data.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi) || [];
        let currentX = 0, currentY = 0, startX = 0, startY = 0, firstPoint = true;
        let relative = false;

        commands.forEach((cmd) => {
            const type = cmd[0].toUpperCase();
            relative = cmd[0] !== type;
            let args = (cmd.slice(1).trim().match(/-?\d+(\.\d+)?/g) || []).map(Number).filter(n => !isNaN(n));

            switch (type) {
                case 'M':
                    for (let i = 0; i < args.length; i += 2) {
                        currentX = relative && !firstPoint ? currentX + args[i] : args[i];
                        currentY = relative && !firstPoint ? currentY + args[i + 1] : args[i + 1];
                        points.push({ x: currentX, y: currentY });
                        if (i === 0) { startX = currentX; startY = currentY; }
                        firstPoint = false;
                    }
                    break;
                case 'L': case 'T':
                    for (let i = 0; i < args.length; i += 2) {
                        currentX = relative ? currentX + args[i] : args[i];
                        currentY = relative ? currentY + args[i + 1] : args[i + 1];
                        points.push({ x: currentX, y: currentY });
                    }
                    break;
                case 'H':
                    for (let i = 0; i < args.length; i++) {
                        currentX = relative ? currentX + args[i] : args[i];
                        points.push({ x: currentX, y: currentY });
                    }
                    break;
                case 'V':
                    for (let i = 0; i < args.length; i++) {
                        currentY = relative ? currentY + args[i] : args[i];
                        points.push({ x: currentX, y: currentY });
                    }
                    break;
                case 'C': case 'S': case 'Q': case 'A':
                    if (args.length >= (type === 'A' ? 7 : (type === 'C' ? 6 : 4))) {
                        currentX = relative ? currentX + args[args.length - 2] : args[args.length - 2];
                        currentY = relative ? currentY + args[args.length - 1] : args[args.length - 1];
                        points.push({ x: currentX, y: currentY });
                    }
                    break;
                case 'Z':
                    currentX = startX; currentY = startY; firstPoint = true;
                    break;
            }
        });

        if (points.length === 0) return null;
        const xs = points.map(p => p.x).filter(x => !isNaN(x));
        const ys = points.map(p => p.y).filter(y => !isNaN(y));
        if (xs.length === 0 || ys.length === 0) return null;
        return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
    }, []);

    const getFloorCenter = useCallback((floorIndex) => {
        const layer = layers[floorIndex];
        if (!layer) return null;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        layer.walls.forEach(wall => {
            const bbox = getPathBoundingBox(wall.data);
            if (bbox) { minX = Math.min(minX, bbox.minX); minY = Math.min(minY, bbox.minY); maxX = Math.max(maxX, bbox.maxX); maxY = Math.max(maxY, bbox.maxY); }
        });
        if (minX === Infinity) return null;
        return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    }, [layers, getPathBoundingBox]);

    useEffect(() => {
        if (!selectedSearchRoom?.id) return;
        let targetLayer, centerX, centerY;
        if (selectedSearchRoom.id.startsWith('floor-') && selectedSearchRoom.id.endsWith('-center')) {
            targetLayer = selectedSearchRoom.floorIndex;
            const center = getFloorCenter(targetLayer);
            if (center) { centerX = center.x; centerY = center.y; }
        } else {
            targetLayer = selectedSearchRoom.floorIndex;
            if (selectedSearchRoom.data && typeof selectedSearchRoom.data === 'string') {
                const bbox = getPathBoundingBox(selectedSearchRoom.data);
                if (bbox) { centerX = bbox.minX + (bbox.maxX - bbox.minX) / 2; centerY = bbox.minY + (bbox.maxY - bbox.minY) / 2; }
            } else if (selectedSearchRoom.x !== undefined && selectedSearchRoom.y !== undefined) {
                centerX = selectedSearchRoom.x + (selectedSearchRoom.width || 0) / 2; centerY = selectedSearchRoom.y + (selectedSearchRoom.height || 0) / 2;
            }
        }
        if (targetLayer !== undefined && targetLayer !== currentMapFloor && layers[targetLayer]) setCurrentMapFloor(targetLayer);
        requestAnimationFrame(() => {
            if (centerX !== undefined && centerY !== undefined) {
                const targetScale = isMobileDevice() ? 0.35 : 0.7;
                const newX = window.innerWidth / 2 - centerX * targetScale;
                const newY = window.innerHeight / 2 - centerY * targetScale;
                setStageScale(targetScale); setStageX(newX); setStageY(newY);
            }
            setSelectedSearchRoom(null);
        });
    }, [selectedSearchRoom, layers, getPathBoundingBox, setSelectedSearchRoom, currentMapFloor, setCurrentMapFloor, isMobileDevice, getFloorCenter]);

    const currentLayerData = useMemo(() => (
        layers[currentMapFloor] || { walls: [], roads: [], rooms: [], vectors: [] }
    ), [layers, currentMapFloor]);

    const renderedWalls = useMemo(() => currentLayerData.walls.map((w, i) => <Path key={`w-${currentMapFloor}-${i}`} data={w.data} stroke={w.stroke || "grey"} strokeWidth={w.strokeWidth || 1} listening={false} perfectDrawEnabled={false} />), [currentLayerData.walls, currentMapFloor]);
    const renderedRoads = useMemo(() => currentLayerData.roads.map((r, i) => <Line key={`rd-${currentMapFloor}-${i}`} points={[r.x1,r.y1,r.x2,r.y2]} stroke={'transparent'} strokeWidth={2} listening={false} perfectDrawEnabled={false} />), [currentLayerData.roads, currentMapFloor]);
    const renderedIcons = useMemo(() => currentLayerData.vectors.map(v => v.data ? <Path key={`v-${currentMapFloor}-${v.id}`} id={v.id.toString()} data={v.data} stroke={v.stroke||"grey"} strokeWidth={v.strokeWidth??1} fill={v.fill} hitStrokeWidth={10} onClick={() => handleIconClick(v)} onTap={(e) => {e.evt.preventDefault(); handleIconClick(v)}} listening={!!(v.name || v.description)} perfectDrawEnabled={false} x={v.x||0} y={v.y||0}/>:null), [currentLayerData.vectors, currentMapFloor, handleIconClick]);

    const renderedRooms = useMemo(() => {
        return currentLayerData.rooms?.map(room => {
            if (!room || !room.id) return null;

            const isSelected = selectedRoom?.id === room.id;
            const isStartSelected = fromRoom?.id === room.id && fromRoom?.floorIndex === currentMapFloor;
            const isEndSelected = toRoom?.id === room.id && toRoom?.floorIndex === currentMapFloor;
            const isHighlighted = highlightedObjectIds.includes(room.id);
            const isCandidateSelected = selectedCandidate?.id === room.id;

            let baseColor = 'rgba(200, 200, 200, 0.3)', strokeColor = "grey", strokeWidth = 0.5;

            if (isStartSelected && isEndSelected) {
                baseColor = 'rgba(255, 165, 0, 0.7)'; strokeColor = 'darkorange'; strokeWidth = 1.5;
            } else if (isStartSelected || isEndSelected) {
                baseColor = 'rgba(255, 0, 0, 0.4)'; strokeColor = 'darkred'; strokeWidth = 1.5;
            } else if (isCandidateSelected) {
                baseColor = 'rgba(0, 255, 127, 0.5)'; strokeColor = 'green'; strokeWidth = 2;
            } else if (isHighlighted) {
                baseColor = 'rgba(255, 215, 0, 0.5)'; strokeColor = 'orange'; strokeWidth = 1.5;
            } else if (room.type === 'stair') {
                baseColor = 'rgba(180, 180, 255, 0.4)'; strokeColor = "darkblue"; strokeWidth = 1;
            } else if (room.type === 'technical') {
                baseColor = 'rgba(210, 210, 210, 0.2)'; strokeColor = "#bbb"; strokeWidth = 0.5;
            }
            if (isSelected) { strokeColor = '#D6322D'; strokeWidth = 2; }

            const commonProps = { id: room.id, stroke: strokeColor, strokeWidth, onClick: () => handleRoomClick(room), onTap: (e) => handleTouchRoom(e, room), listening: !!(room.name || room.description), perfectDrawEnabled: false, fill: baseColor };
            const textProps = { text: room.name || '', fontSize: 13, fill: '#333', listening: false, align: 'center', verticalAlign: 'middle', fontFamily: "'Nunito', sans-serif" };
            const displayText = room.name || '';

            if (room.data && typeof room.data === 'string') {
                const bbox = getPathBoundingBox(room.data);
                if (!bbox) return null;
                return (
                    <Group key={`${room.id}-${currentMapFloor}`}>
                        <Path {...commonProps} data={room.data} />
                        {displayText && <Text {...textProps} x={bbox.minX} y={bbox.minY} width={bbox.maxX - bbox.minX} height={bbox.maxY - bbox.minY} clipFunc={ctx => { const p = new Path2D(room.data); ctx.clip(p); }} />}
                    </Group>
                );
            }
            if (room.x !== undefined) {
                return (
                    <Group key={`${room.id}-${currentMapFloor}`}>
                        <Rect {...commonProps} x={room.x} y={room.y} width={room.width} height={room.height} />
                        {displayText && <Text {...textProps} x={room.x} y={room.y} width={room.width} height={room.height} />}
                    </Group>
                );
            }
            return null;
        });
    }, [currentLayerData.rooms, currentMapFloor, fromRoom, toRoom, selectedRoom, highlightedObjectIds, selectedCandidate, getPathBoundingBox, handleRoomClick, handleTouchRoom]);

    if (loading) return <div style={{position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)'}}>Загрузка...</div>;
    if (loadError) return <div style={{color:'red', position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)'}}>{loadError}</div>;

    return (
        <>
            <div className="floor-buttons">
                {[0, 1, 2, 3, 4].map(floorIndex => (
                    layers[floorIndex] ? (
                        <button
                            key={`fb-${floorIndex}`}
                            className={`floor-button ${currentMapFloor === floorIndex ? 'active' : ''}`}
                            onClick={() => setCurrentMapFloor(floorIndex)}
                        >
                            {floorIndex}
                        </button>
                    ) : null
                ))}
            </div>
            <Stage
                height={window.innerHeight} width={window.innerWidth}
                onWheel={handleWheel} onTouchMove={handleMultiTouch} onTouchEnd={multiTouchEnd}
                onDragStart={handleDragStart} onDragEnd={handleDragEnd}
                scaleX={stageScale} scaleY={stageScale} x={stageX} y={stageY}
                draggable={isMapActive && !isZooming} ref={stageRef}
                style={{ background: "#F3F3F4", cursor: isMapActive ? 'grab' : 'default' }}
            >
                <Layer>
                    {renderedWalls}
                    {renderedRoads}
                    {renderedIcons}
                    {renderedRooms}
                    <RouteMap currentFloorIndex={currentMapFloor} mapDataPath={MAP_DATA_URL} />
                </Layer>
            </Stage>
            <RoomInfoModal room={selectedRoom} onClose={() => setSelectedRoom(null)} />
        </>
    );
}

export default BuildingMap;