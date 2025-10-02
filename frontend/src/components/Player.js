import React from "react";

function Player({ audioUrl }) {
  return (
    <div>
      <h3>Generated Speech</h3>
      <audio controls>
        <source src={audioUrl} type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
    </div>
  );
}

export default Player;
