import React, { useEffect } from 'react';
import './App.css';
import BuildingMap from "./components/BuildingMap.jsx";
import BottomMenu from "./components/BottomMenu.jsx";
import useStore from './components/store.jsx';
import Header from './components/Header.jsx';
import RouteInstructionsModal from './components/RouteInstructionsModal.jsx';
import FeedbackForm from "./components/FeedbackForm.jsx";

function App() {
    const { activeMenu, setPendingFromRoomId } = useStore();

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        // Try to get the value of the 'fromRoomId' parameter
        const fromRoomId = urlParams.get('fromRoomId');

        // Check if the 'fromRoomId' parameter exists in the URL
        if (fromRoomId) {
            console.log(`[App] Found fromRoomId in URL: ${fromRoomId}`);

            setPendingFromRoomId(fromRoomId);


            const newUrl = window.location.pathname; // Get the current path without the query string
            window.history.replaceState({}, document.title, newUrl); // Update the URL without reloading
            console.log('[App] Cleaned URL parameter.');
        }
    }, [setPendingFromRoomId]);

    return (
        <>
            <Header/>
            {/* Передаем mapDataPath в BuildingMap, если он динамический */}
            <BuildingMap isMapActive={!activeMenu} />
            <BottomMenu/>

            <RouteInstructionsModal />

        </>
    );
}

export default App;