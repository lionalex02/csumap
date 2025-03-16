import {Layer, Path, Rect, Stage, Text} from "react-konva";
import {useEffect, useState} from "react";

function BuildingMap() {
  const [stage, setStage] = useState({
    scale: 0.3,
    x: 300,
    y: 300
  });

  const [coords, setCoords] = useState({})

  const handleWheel = (e) => {
    e.evt.preventDefault();

    const scaleBy = 1.02;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const mousePointTo = {
      x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
      y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;

    setStage({
      scale: newScale,
      x: (stage.getPointerPosition().x / newScale - mousePointTo.x) * newScale,
      y: (stage.getPointerPosition().y / newScale - mousePointTo.y) * newScale
    });
  };

  const [layers, setLayers] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://127.0.0.1:5000/map_data").then((response) => {
        response.json().then(
          (response) => {
            setLayers(response)
            setLoading(false)
          }
        )
      }
    );
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  const clickHandler = () => {
    console.log(layers.floors[2].rooms[0].x, layers.floors[2].rooms[0].y);
  }

  const moveHandler = (e) => {
    setCoords({x: e.evt.clientX, y: e.evt.clientY})
  }

  return (
    <>
      <button onClick={clickHandler}></button>
      <div>X:{coords.x}, Y:{coords.y}</div>
      <Stage height={window.innerHeight}
             width={window.innerWidth}
             onWheel={handleWheel}
             onMouseMove={moveHandler}
             scaleX={stage.scale}
             scaleY={stage.scale}
             x={stage.x}
             y={stage.y}
             draggable
      >
        <Layer>

          {layers.floors.map((floor) => (
              floor.rooms.map(room => (
                  <Rect
                    key={room.id}
                    x={room.x}
                    y={room.y - 1000}
                    width={room.width}
                    height={room.height}
                    fill={"white"}
                    stroke={"black"}
                    strokeWidth={1}
                    onClick={() => {
                      alert(room.id)
                    }}
                  >
                  </Rect>
                )
              )
            )
          )}
          {layers.floors.map((floor) => (
            floor.path.map((path) => (
              <Path
                data={path.d}
                fill={path.fill}
                stroke={path.stroke}
                strokeWidth={path.strokeWidth}
              >

              </Path>
            ))
          ))}

        </Layer>
      </Stage>
    </>
  );

}

export default BuildingMap;