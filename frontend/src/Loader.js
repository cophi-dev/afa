import React from 'react';
import './Loader.css';  // Assuming you will create a Loader.css for styling

function Loader({ backgroundColor }) {
    return (
        <div className="loader" style={{ backgroundColor }}>
            Loading new perspective...
        </div>
    );
}

export default Loader;