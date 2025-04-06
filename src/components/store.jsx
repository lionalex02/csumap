import { create } from 'zustand';

export const availableBuildings = [
    { id: 'building1', name: 'Корпус 1' },
    { id: 'building2', name: 'Корпус 2' },
    { id: 'building3', name: 'Корпус 3' },
];

const useStore = create((set) => ({
    fromRoom: null,
    toRoom: null,
    rooms: [],
    activeMenu: null,
    selectedSearchRoom: null,
    isBuildingModalOpen: false,
    selectedBuilding: availableBuildings[0],


    setFromRoom: (room) => set({ fromRoom: room }),
    setToRoom: (room) => set({ toRoom: room }),
    setRooms: (rooms) => set({ rooms }),
    setActiveMenu: (menu) => set({ activeMenu: menu }),
    setSelectedSearchRoom: (room) => set({ selectedSearchRoom: room }),
    setIsBuildingModalOpen: (isOpen) => set({ isBuildingModalOpen: isOpen }),
    setSelectedBuilding: (building) => set({ selectedBuilding: building }),
}));

export default useStore;