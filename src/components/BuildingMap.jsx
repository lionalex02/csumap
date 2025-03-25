import {Layer, Path, Rect, Stage, Text, Group} from "react-konva";
import React, {useEffect, useMemo, useRef, useState} from "react"; // Исправленный импорт
import RoomInfoModal from "./RoomInfoModal.jsx";
import '../BuildingMap.css'
import useStore from './store.jsx';


function BuildingMap({isMapActive}) {
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    const [stageScale, setStageScale] = useState(isMobileDevice() ? 0.3 : 0.5);
    const [stageX, setStageX] = useState(isMobileDevice() ? -80 : 250);
    const [stageY, setStageY] = useState(isMobileDevice()? 0 : -150);

    const [isZooming, setIsZooming] = useState(false);
    const [curLayer, setCurLayer] = useState(0)

    const [layers, setLayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRoom, setSelectedRoom] = useState(null);

    function getCenter(p1, p2) {
        return {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2,
        };
    }

    const lastCenterRef = useRef(null);
    const lastDistRef = useRef(0);

    const handleMultiTouch = (e) => {
        if (!isMapActive) return;
        e.evt.preventDefault();

        const touch1 = e.evt.touches[0];
        const touch2 = e.evt.touches[1];
        const stage = e.target.getStage();

        if (touch1 && touch2) {
            stage.stopDrag();
            setIsZooming(true);

            const p1 = {
                x: touch1.clientX,
                y: touch1.clientY,
            };
            const p2 = {
                x: touch2.clientX,
                y: touch2.clientY,
            };

            if (!lastCenterRef.current || !lastDistRef.current) {
                lastCenterRef.current = getCenter(p1, p2);
                lastDistRef.current = getDistance(p1, p2);
                return;
            }
            const newCenter = getCenter(p1, p2);

            function getDistance(p1, p2) {
                return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
            }

            const dist = getDistance(p1, p2);

            if (!lastDistRef.current) {
                lastDistRef.current = dist;
            }

            var pointTo = {
                x: (newCenter.x - stage.x()) / stage.scaleX(),
                y: (newCenter.y - stage.y()) / stage.scaleX(),
            };

            var scale = stage.scaleX() * (dist / lastDistRef.current);

            const minScale = 0.3; // Минимальный масштаб
            const maxScale = 3; // Максимальный масштаб
            scale = Math.max(minScale, Math.min(scale, maxScale));

            stage.scaleX(scale);
            stage.scaleY(scale);

            const dx = newCenter.x - lastCenterRef.current.x;
            const dy = newCenter.y - lastCenterRef.current.y;

            const newPos = {
                x: newCenter.x - pointTo.x * scale + dx,
                y: newCenter.y - pointTo.y * scale + dy,
            };

            stage.position(newPos);
            stage.batchDraw();

            lastDistRef.current = dist;
            lastCenterRef.current = newCenter;
        }
    };

    const multiTouchEnd = () => {
        lastCenterRef.current = null;
        lastDistRef.current = 0;
        setIsZooming(false);
    };


    const handleWheel = (e) => {
        if (!isMapActive) return;
        e.evt.preventDefault();

        const scaleBy = 1.2;
        const stage = e.target.getStage();
        const oldScale = stage.scaleX();
        const mousePointTo = {
            x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
            y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale,
        };

        const newScale =
            e.evt.deltaY < 0
                ? oldScale > 3
                    ? oldScale
                    : oldScale * scaleBy
                : oldScale < 0.4
                    ? oldScale
                    : oldScale / scaleBy;

        setStageScale(newScale);
        setStageX(
            -(mousePointTo.x - stage.getPointerPosition().x / newScale) * newScale
        );
        setStageY(
            -(mousePointTo.y - stage.getPointerPosition().y / newScale) * newScale
        );
    };

    useEffect(() => {
        fetch("https://staticstorm.ru/map/map_data2").then((response) => {
                response.json().then(
                    (response) => {
                        setLayers(response.layers);
                        setLoading(false);

                        const allRooms = response.layers.flatMap(layer => layer.rooms);
                        useStore.getState().setRooms(allRooms);
                    }
                )
            }
        );
    }, []);

    const handleDragStart = (e) => {
        if (!isMapActive) return;
        const stage = e.target.getStage();

        if (isZooming) {
            stage.stopDrag();
        }

        console.log(stage.isDragging());
    };


    //темка для модалки
    const handleRoomClick = (room) => {
        if (!isMapActive) return;
        setSelectedRoom(room);
    };

    const handleTouchRoom = (e, room) => {
        if (!isMapActive) return;
        e.evt.preventDefault(); // Предотвращаем стандартное поведение на мобильных устройствах
        handleRoomClick(room);
    };

    const handleLayerChange = (layerIndex) => {
        if (!isMapActive) return;
        setCurLayer(layerIndex);
    };

    const renderedWalls = useMemo(() =>
        (layers[curLayer]?.walls.map(wall => (
            <Path
                data={wall.data}
                stroke={"black"}
            />
        ))),
    )

    const renderedIcons = useMemo(() => (
        layers[curLayer]?.vectors.map((vector) => (
            <Path
                data={vector.data}
                stroke={"black"}
                strokeWidth={1}
            />
        ))
    ))

    const renderedRooms = useMemo(() => (
        layers[curLayer]?.rooms.map(room => {
            if (room.x === undefined) {
                return (

                    <Path
                        key={room.id}
                        id={room.id}
                        data={room.data}
                        stroke={"black"}
                        strokeWidth={1}
                        onClick={() => handleRoomClick(room)}
                        onTap={(e) => handleTouchRoom(e, room)}
                    />

                )
            }
            return (
                <React.Fragment key={room.id}>
                    <Rect
                        id={room.id}
                        x={room.x}
                        y={room.y}
                        width={room.width}
                        height={room.height}
                        stroke="black"
                        strokeWidth={1}
                        onClick={() => handleRoomClick(room)}
                        onTap={(e) => handleTouchRoom(e, room)}
                    />
                    <Text
                        x={room.x + room.width / 2}
                        y={room.y + room.height / 2}
                        offsetX={room.width / 4}
                        offsetY={7}
                        text={room.id}
                        fontSize={14}
                        fill="black"
                    />
                </React.Fragment>
            );
        })

    ), [curLayer, layers]);


    if (loading) {
        return <div>Loading...</div>;
    }


    return (
        <>
            <div className="floor-buttons">
                {[4, 0, 1, 2, 3].map((layerIndex) => (
                    <button
                        key={layerIndex}
                        className={`floor-button ${curLayer === layerIndex ? 'active' : ''}`}
                        onClick={() => handleLayerChange(layerIndex)}
                    >
                        {layerIndex === 4 ? '0' : `${layerIndex + 1}`}
                    </button>
                ))}
            </div>
            <Stage height={window.innerHeight}
                   width={window.innerWidth}
                   onWheel={handleWheel}
                   onTouchMove={handleMultiTouch}
                   onTouchEnd={multiTouchEnd}
                   onDragStart={handleDragStart}
                   scaleX={stageScale}
                   scaleY={stageScale}
                   x={stageX}
                   y={stageY}
                   draggable
            >
                <Layer>
                    {renderedWalls}
                    {renderedRooms}
                    {renderedIcons}
                </Layer>
            </Stage>
            <RoomInfoModal room={selectedRoom} onClose={() => setSelectedRoom(null)}/>
        </>
    );

}

export default BuildingMap;