import { useEffect, useState } from "react";
import { API_BASE } from "./api.js";

const QUEUE_POLL_INTERVAL = 1500;

function formatQueueNumber(number) {
  return number === null || number === undefined ? "--" : String(number).padStart(2, "0");
}

function QueueDisplay() {
  const [currentNumber, setCurrentNumber] = useState(null);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    let previousNumber = null;
    let isActive = true;

    const fetchCurrentNumber = async () => {
      try {
        const response = await fetch(`${API_BASE}/queue/current`);
        if (!response.ok) return;
        const data = await response.json();
        if (!isActive || data.current_number === previousNumber) return;
        previousNumber = data.current_number;
        setCurrentNumber(data.current_number);
        setAnimationKey((key) => key + 1);
      } catch (error) {
        console.error("Failed to load queue number", error);
      }
    };

    fetchCurrentNumber();
    const interval = setInterval(fetchCurrentNumber, QUEUE_POLL_INTERVAL);
    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <main className="queue-display-page" aria-live="polite">
      <div className="queue-display-panel">
        <p className="queue-display-kicker">Now Serving</p>
        <div className="queue-display-number" key={animationKey}>
          {formatQueueNumber(currentNumber)}
        </div>
        <p className="queue-display-instruction">Please proceed to the clinic</p>
      </div>
    </main>
  );
}

export default QueueDisplay;
