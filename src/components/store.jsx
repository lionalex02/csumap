import { create } from 'zustand';

export const availableBuildings = [
    { id: 'building1', name: 'Корпус 1' },
    { id: 'building2', name: 'Корпус 2' },
    { id: 'building3', name: 'Корпус 3' },
];

const initialFloor = 0;

const useStore = create((set, get) => ({
    fromRoom: null,
    toRoom: null,
    rooms: [],
    activeMenu: null,
    selectedSearchRoom: null,
    buildRouteTrigger: null,

    isRouteInstructionsVisible: false,
    routeInstructions: [],
    currentInstructionIndex: 0,

    graphData: { graph: null, nodeCoords: null },
    calculatedPath: null,
    currentMapFloor: initialFloor,


    setFromRoom: (room) => set({ fromRoom: room }),
    setToRoom: (room) => set({ toRoom: room }),

    setRooms: (rooms) => set({ rooms }),
    setActiveMenu: (menu) => set({ activeMenu: menu }),
    setSelectedSearchRoom: (room) => set({ selectedSearchRoom: room }),
    setIsBuildingModalOpen: (isOpen) => set({ isBuildingModalOpen: isOpen }),
    setSelectedBuilding: (building) => set({
        selectedBuilding: building,
        fromRoom: null, // Сбрасываем при смене корпуса
        toRoom: null,
        buildRouteTrigger: null,
        isRouteInstructionsVisible: false,
        routeInstructions: [],
        currentInstructionIndex: 0,
        calculatedPath: null,
        graphData: { graph: null, nodeCoords: null },
        currentMapFloor: initialFloor,
    }),
    triggerRouteBuild: () => set((state) => {
        // Перед построением маршрута, очистим старые инструкции и путь, если они есть
        const newState = {
            buildRouteTrigger: Date.now(),
            isRouteInstructionsVisible: false,
            routeInstructions: [],
            currentInstructionIndex: 0,
            calculatedPath: null
        };
        // Если точки не заданы, не строим
        if (!state.fromRoom || !state.toRoom) {
            newState.buildRouteTrigger = null; // Отменяем триггер
        }
        return newState;
    }),

    setGraphData: (graph, nodeCoords) => set({ graphData: { graph, nodeCoords } }),
    setCalculatedPath: (path) => set({ calculatedPath: path }),
    setCurrentMapFloor: (floorIndex) => set({ currentMapFloor: floorIndex }),

    setIsRouteInstructionsVisible: (isVisible) => set({ isRouteInstructionsVisible: isVisible }),
    setRouteInstructions: (instructions) => set({
        routeInstructions: instructions,
        currentInstructionIndex: 0,
        isRouteInstructionsVisible: instructions && instructions.length > 0,
    }),
    setCurrentInstructionIndex: (index) => set({ currentInstructionIndex: index }),

    goToNextInstruction: () => {
        const {
            currentInstructionIndex,
            routeInstructions,
            setCurrentMapFloor,
            setSelectedSearchRoom,
            graphData,
        } = get();

        const nextIndex = currentInstructionIndex + 1;

        if (nextIndex < routeInstructions.length) {
            const nextInstruction = routeInstructions[nextIndex];

            if (nextInstruction.type === 'transition' && nextInstruction.targetFloor !== undefined) {
                setCurrentMapFloor(nextInstruction.targetFloor);
                const transitionStartNodeId = nextInstruction.nodeId;
                if (transitionStartNodeId && graphData.nodeCoords?.has(transitionStartNodeId)) {
                    const nodeData = graphData.nodeCoords.get(transitionStartNodeId);
                    if (nodeData) {
                        const centerTarget = {
                            id: `focus_${transitionStartNodeId}_${Date.now()}`,
                            floorIndex: nodeData.floorIndex,
                            x: nodeData.x,
                            y: nodeData.y,
                        };
                        setSelectedSearchRoom(centerTarget);
                    }
                }

            }
            set({ currentInstructionIndex: nextIndex });
        }
    },

    goToPreviousInstruction: () => {
        const {
            currentInstructionIndex,
            routeInstructions,
            setCurrentMapFloor,
            setSelectedSearchRoom,
            graphData
        } = get();

        const prevIndex = currentInstructionIndex - 1;

        if (prevIndex >= 0) {
            const currentInstruction = routeInstructions[currentInstructionIndex];
            const prevInstruction = routeInstructions[prevIndex];

            if (currentInstruction.type === 'transition' && prevInstruction.type === 'walk') {
                if (prevInstruction.floor !== undefined) {
                    setCurrentMapFloor(prevInstruction.floor);
                    const walkEndNodeId = currentInstruction.originNodeId;
                    if (walkEndNodeId && graphData.nodeCoords?.has(walkEndNodeId)) {
                        const nodeData = graphData.nodeCoords.get(walkEndNodeId);
                        if (nodeData) {
                            const centerTarget = {
                                id: `focus_${walkEndNodeId}_${Date.now()}`,
                                floorIndex: nodeData.floorIndex,
                                x: nodeData.x,
                                y: nodeData.y,
                            };
                            setSelectedSearchRoom(centerTarget);
                        }
                    }
                }
            }
            else if (currentInstruction.type === 'walk' && prevInstruction.type === 'transition') {
                if (prevInstruction.originFloor !== undefined) {
                    setCurrentMapFloor(prevInstruction.originFloor);
                    const transitionStartNodeId = prevInstruction.originNodeId;
                    if (transitionStartNodeId && graphData.nodeCoords?.has(transitionStartNodeId)) {
                        const nodeData = graphData.nodeCoords.get(transitionStartNodeId);
                        if (nodeData) {
                            const centerTarget = {
                                id: `focus_${transitionStartNodeId}_${Date.now()}`,
                                floorIndex: nodeData.floorIndex,
                                x: nodeData.x,
                                y: nodeData.y,
                            };
                            setSelectedSearchRoom(centerTarget);
                        }
                    }
                }
            }

            set({ currentInstructionIndex: prevIndex });
        }
    },


    clearRouteAndInstructions: () => set({
        buildRouteTrigger: null,
        isRouteInstructionsVisible: false,
        routeInstructions: [],
        currentInstructionIndex: 0,
        calculatedPath: null,
        fromRoom: null, // Сбрасываем точки для сброса подсветки
        toRoom: null,
    }),

    isBuildingModalOpen: false,
    selectedBuilding: availableBuildings[0],
}));

export default useStore;