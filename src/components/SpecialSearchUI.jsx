// src/components/SpecialSearchUI.jsx
import React, { useEffect } from 'react';
import useStore from './store.jsx';

const containerStyle = { position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 1003, background: 'white', padding: '15px', borderRadius: '15px', boxShadow: '0 0 10px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', width: '90%', maxWidth: '450px' };
const buttonStyle = { borderWidth: '1px', borderStyle: 'solid', borderColor: '#ccc', background: 'white', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' };
const activeButtonStyle = { ...buttonStyle, background: '#d6322d', color: 'white', borderColor: '#d6322d' };
const closeButtonStyle = { position: 'absolute', top: -10, right: -10, background: '#d6322d', color: 'white', border: '2px solid white', borderRadius: '50%', width: '25px', height: '25px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', lineHeight: '1' };

const FilterBar = ({ config, activeFilterId, onFilterChange }) => (
    <div style={{ display: 'flex', gap: '10px', padding: '5px 0' }}>
        {config.filterProperties.map(filter => (
            <button key={filter.id} onClick={() => onFilterChange(filter.id)} style={activeFilterId === filter.id ? activeButtonStyle : buttonStyle}>
                {filter.label}
            </button>
        ))}
    </div>
);
const NearestObjectSelector = ({ candidates, selectedIndex, onSelect, onConfirm }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', justifyContent: 'space-between' }}>
        <button onClick={() => onSelect(selectedIndex - 1)} disabled={selectedIndex <= 0} style={buttonStyle}>{'<'}</button>
        <div style={{ textAlign: 'center' }}>
            <div>{candidates[selectedIndex]?.room.name || candidates[selectedIndex]?.room.description}</div>
            <div style={{fontSize: '12px', color: '#666'}}>~{candidates[selectedIndex]?.distance.toFixed(0)/25} м</div>
        </div>
        <button onClick={() => onSelect(selectedIndex + 1)} disabled={selectedIndex >= candidates.length - 1} style={buttonStyle}>{'>'}</button>
        <button onClick={onConfirm} style={activeButtonStyle}>Маршрут</button>
    </div>
);

function SpecialSearchUI() {
    const specialSearch = useStore(state => state.specialSearch);
    const fromRoom = useStore(state => state.fromRoom);

    const {
        calculateNearestObjects,
        setSpecialSearchFilter,
        resetStartPointSelection,
        setSpecialSearchIndex,
        setToRoom,
        triggerRouteBuild,
        clearSpecialSearch,
        setSelectedSearchRoom
    } = useStore.getState();

    const activeFilterId = specialSearch?.activeFilterId;
    const status = specialSearch?.status;
    const selectedIndex = specialSearch?.selectedIndex;
    const candidates = specialSearch?.candidates;

    useEffect(() => {
        if (fromRoom && status?.startsWith('pending')) {
            calculateNearestObjects();
        }
    }, [fromRoom, activeFilterId, status, calculateNearestObjects]);

    useEffect(() => {
        if (status === 'selection' && candidates && candidates.length > 0) {
            const selectedCandidateRoom = candidates[selectedIndex]?.room;
            if (selectedCandidateRoom) {
                setSelectedSearchRoom(selectedCandidateRoom);
            }
        }
    }, [selectedIndex, status, candidates, setSelectedSearchRoom]);

    if (!specialSearch) return null;

    const handleConfirmSelection = () => {
        const selectedRoom = candidates[selectedIndex]?.room;
        if (selectedRoom) {
            setToRoom(selectedRoom);
            triggerRouteBuild();
            clearSpecialSearch();
        }
    };

    return (
        <div style={containerStyle}>
            {status === 'pending_filters' && (
                <>
                    <p style={{ margin: 0, fontWeight: 'bold' }}>Куда вы хотите пойти?</p>
                    <FilterBar config={specialSearch.config} activeFilterId={activeFilterId} onFilterChange={setSpecialSearchFilter} />
                    <p style={{ margin: 0, fontSize: '14px', color: '#555' }}>Выберите фильтр, а затем укажите ваше местоположение на карте.</p>
                </>
            )}

            {status === 'pending_start_point' && (
                <>
                    <p style={{ margin: 0, fontWeight: 'bold' }}>Откуда начать поиск?</p>
                    {!fromRoom ? (
                        <p style={{ margin: 0, fontSize: '14px', color: '#555' }}>Укажите ваше местоположение на карте.</p>
                    ) : (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <span>{fromRoom.name}</span>
                            <button onClick={resetStartPointSelection} style={buttonStyle}>Изменить</button>
                        </div>
                    )}
                </>
            )}

            {status === 'calculating' && <div>Идет поиск...</div>}

            {status === 'selection' && (
                candidates.length > 0 ? (
                    <NearestObjectSelector candidates={candidates} selectedIndex={selectedIndex} onSelect={setSpecialSearchIndex} onConfirm={handleConfirmSelection} />
                ) : (
                    <div>
                        <p>Объекты не найдены с учетом фильтров.</p>
                        <button onClick={resetStartPointSelection} style={buttonStyle}>Попробовать снова</button>
                    </div>
                )
            )}
            <button onClick={clearSpecialSearch} style={closeButtonStyle}>✕</button>
        </div>
    );
}

export default SpecialSearchUI;