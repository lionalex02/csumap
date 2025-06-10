// src/components/HighlightOverlay.jsx
import React from 'react';
import useStore from './store.jsx';

const overlayStyle = {
    position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
    zIndex: 1003, background: 'rgba(214, 50, 45, 0.9)', color: 'white',
    padding: '10px 20px', borderRadius: '15px', display: 'flex',
    alignItems: 'center', gap: '15px', boxShadow: '0 0 10px rgba(0,0,0,0.2)'
};

const buttonStyle = {
    background: 'rgba(255, 255, 255, 0.2)', border: '1px solid white',
    color: 'white', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer'
};

function HighlightOverlay() {
    const highlightedObjectIds = useStore(state => state.highlightedObjectIds);
    const setHighlightedObjectIds = useStore(state => state.setHighlightedObjectIds);

    if (highlightedObjectIds.length === 0) {
        return null;
    }

    return (
        <div style={overlayStyle}>
            <span>Показаны объекты ({highlightedObjectIds.length} шт.)</span>
            <button onClick={() => setHighlightedObjectIds([])} style={buttonStyle}>Сбросить</button>
        </div>
    );
}

export default HighlightOverlay;