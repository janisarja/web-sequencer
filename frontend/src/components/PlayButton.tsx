const PlayButton = ({ play }: { play: () => void }) => {
  return (
    <button onClick={play} className="play-button">
      <span className="play-button__dot" />
      Play / Stop
    </button>
  );
};

export default PlayButton;
