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

    isBuildingModalOpen: false,
    selectedBuilding: availableBuildings[0],

    // Route Instructions State
    isRouteInstructionsVisible: false,
    routeInstructions: [],
    currentInstructionIndex: 0,

    // Map & Pathfinding State (managed mostly by RouteMap now)
    graphData: { graph: null, nodeCoords: null },
    calculatedPath: null,
    currentMapFloor: initialFloor,

    // State for QR Code Handling
    pendingFromRoomId: null,

    // --- Actions ---

    setFromRoom: (room) => set({ fromRoom: room }),
    setToRoom: (room) => set({ toRoom: room }),

    setRooms: (rooms) => set((state) => {
        // This action now also processes the pending QR code room ID
        const newState = { rooms };
        if (state.pendingFromRoomId && rooms?.length > 0) {
            const foundRoom = rooms.find(r => r.id === state.pendingFromRoomId);
            if (foundRoom) {
                console.log(`[Store] Processing pendingFromRoomId: ${state.pendingFromRoomId}. Found:`, foundRoom.name);
                newState.fromRoom = foundRoom; // Set the 'from' room
                newState.activeMenu = 'route'; // Open the route menu
                newState.pendingFromRoomId = null; // Clear the pending ID
            } else {
                console.warn(`[Store] Pending room ID ${state.pendingFromRoomId} not found in loaded rooms.`);
                newState.pendingFromRoomId = null; // Clear even if not found to avoid retrying
            }
        }
        return newState;
    }),

    setActiveMenu: (menu) => set({ activeMenu: menu }),
    setSelectedSearchRoom: (room) => set({ selectedSearchRoom: room }),

    // Building Selection Actions
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

    // Route Building Action
    triggerRouteBuild: () => set((state) => {
        // Only trigger if both start and end points are selected
        if (!state.fromRoom || !state.toRoom) {
            console.warn("[Store] Cannot trigger route build: Missing 'from' or 'to' room.");
            return { buildRouteTrigger: null };
        }
        return {
            buildRouteTrigger: Date.now(),
            isRouteInstructionsVisible: false,
            routeInstructions: [],
            currentInstructionIndex: 0,
            calculatedPath: null
        };
    }),

    // Path & Map State Actions (Primarily used by RouteMap)
    setGraphData: (graph, nodeCoords) => set({ graphData: { graph, nodeCoords } }),
    setCalculatedPath: (path) => set({ calculatedPath: path }),
    setCurrentMapFloor: (floorIndex) => set({ currentMapFloor: floorIndex }),

    // Route Instructions Actions
    setIsRouteInstructionsVisible: (isVisible) => set({ isRouteInstructionsVisible: isVisible }),
    setRouteInstructions: (instructions) => set({
        routeInstructions: instructions,
        currentInstructionIndex: 0,
        isRouteInstructionsVisible: instructions && instructions.length > 0,
    }),
    setCurrentInstructionIndex: (index) => set({ currentInstructionIndex: index }),

    // Navigation through instructions
    goToNextInstruction: () => set((state) => {
        const nextIndex = state.currentInstructionIndex + 1;
        if (nextIndex < state.routeInstructions.length) {
            return { currentInstructionIndex: nextIndex };
            // Consider adding logic here to call setCurrentMapFloor or setSelectedSearchRoom
            // based on the `routeInstructions[nextIndex]` content if needed.
        }
        return {}; // No change if already at the end
    }),
    goToPreviousInstruction: () => set((state) => {
        const prevIndex = state.currentInstructionIndex - 1;
        if (prevIndex >= 0) {
            return { currentInstructionIndex: prevIndex };
        }
        return {};
    }),

    // Action to clear the current route and related state
    clearRouteAndInstructions: () => set({
        buildRouteTrigger: null, // Stop RouteMap from drawing the path
        isRouteInstructionsVisible: false,
        routeInstructions: [],
        currentInstructionIndex: 0,
        calculatedPath: null,
        fromRoom: null, // Clear selection highlights/state
        toRoom: null,
    }),

    // Action for QR Code Handling (called by App.jsx on load)
    setPendingFromRoomId: (roomId) => {
        // This action checks if rooms are already loaded.
        // If yes, it processes the ID immediately.
        // If no, it stores the ID in `pendingFromRoomId`.
        // The actual setting of `fromRoom` and `activeMenu` will happen
        // inside the `setRooms` action when the data becomes available.
        const currentRooms = get().rooms;
        if (currentRooms && currentRooms.length > 0) {
            const foundRoom = currentRooms.find(r => r.id === roomId);
            if (foundRoom) {
                console.log(`[Store] Setting 'from' immediately for ID: ${roomId}. Found:`, foundRoom.name);
                set({ fromRoom: foundRoom, activeMenu: 'route', pendingFromRoomId: null });
            } else {
                console.warn(`[Store] Room ID ${roomId} from URL not found even after load.`);
                set({ pendingFromRoomId: null }); // Clear anyway
            }
        } else {
            // Rooms not loaded yet, store the ID for later processing in setRooms
            console.log(`[Store] Storing pendingFromRoomId: ${roomId}`);
            set({ pendingFromRoomId: roomId });
        }
    },

}));

export default useStore;