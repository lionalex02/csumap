// src/App.jsx
import React, { useEffect } from 'react';
import './App.css';
import BuildingMap from "./components/BuildingMap.jsx";
import BottomMenu from "./components/BottomMenu.jsx";
import useStore from './components/store.jsx';
import Header from './components/Header.jsx';
import RouteInstructionsModal from './components/RouteInstructionsModal.jsx';
import SpecialSearchUI from './components/SpecialSearchUI.jsx';
import HighlightOverlay from './components/HighlightOverlay.jsx';

function App() {
    const { activeMenu, setPendingFromRoomId } = useStore();

    const currentRouteNodeId = useStore(state => state.currentRouteNodeId);
    const graphData = useStore(state => state.graphData);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const fromRoomId = urlParams.get('fromRoomId');
        if (fromRoomId) {
            console.log(`[App] Found fromRoomId in URL: ${fromRoomId}`);
            setPendingFromRoomId(fromRoomId);
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
            console.log('[App] Cleaned URL parameter.');
        }
    }, [setPendingFromRoomId]);

    useEffect(() => {
        if (currentRouteNodeId && graphData.nodeCoords) {
            const nodeInfo = graphData.nodeCoords.get(currentRouteNodeId);
            if (nodeInfo) {
                useStore.getState().setSelectedSearchRoom({
                    ...nodeInfo,
                    id: currentRouteNodeId,
                });
            }
        }
    }, [currentRouteNodeId, graphData.nodeCoords]);

    return (
        <>
            <Header />
            <BuildingMap isMapActive={!activeMenu} />
            <BottomMenu />
            <RouteInstructionsModal />
            <HighlightOverlay />
            <SpecialSearchUI />
        </>
    );
}

export default App;