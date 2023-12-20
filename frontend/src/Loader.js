import React from 'react';
import './Loader.css';  // Assuming you will create a Loader.css for styling

function Loader({ backgroundColor }) {
    return (
        <div className="loader" style={{ backgroundColor }}>
            Waiting for your Ape to change their perspective...
        </div>
    );
}

export default Loader;