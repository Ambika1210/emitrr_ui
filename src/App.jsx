import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import confetti from 'canvas-confetti';
import { Trophy, User, LogOut, Send, Timer } from 'lucide-react';

const SOCKET_URL = 'wss://emitrr-backend-kgt9.onrender.com/ws';
const API_URL = 'https://emitrr-backend-kgt9.onrender.com';

export default function App() {
  const [username, setUsername] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [roomID, setRoomID] = useState('');
  const [opponent, setOpponent] = useState('');
  const [status, setStatus] = useState('Lobby'); // Lobby, Waiting, Playing, Finished
  const [leaderboard, setLeaderboard] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await axios.get(`${API_URL}/leaderboard`);
      setLeaderboard(res.data || []);
    } catch (err) {
      console.error("Failed to fetch leaderboard", err);
    }
  };

  const joinGame = () => {
    if (!username.trim()) return;

    const ws = new WebSocket(`${SOCKET_URL}?username=${username}`);

    ws.onopen = () => {
      setIsJoined(true);
      setStatus('Waiting');
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'GAME_START') {
        setRoomID(msg.roomId);
        setOpponent(msg.opponent);
        setStatus('Playing');
      } else if (msg.type === 'GAME_STATE') {
        setGameState(msg.payload);
        if (msg.payload.isFinished) {
          setStatus('Finished');
          if (msg.payload.winner > 0) {
            handleWin(msg.payload.winner);
          }
        }
      }
    };

    ws.onclose = () => {
      setIsJoined(false);
      setStatus('Lobby');
      setGameState(null);
    };

    socketRef.current = ws;
  };

  const handleWin = (winnerCode) => {
    const isMe = (winnerCode === 1); // Assuming Player 1 is always the one who joined first in our simple logic, 
    // but better to check backend state.
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const makeMove = (col) => {
    if (status !== 'Playing' || !socketRef.current) return;

    const moveMsg = {
      type: 'MOVE',
      payload: {
        column: col,
        roomId: roomID
      }
    };
    socketRef.current.send(JSON.stringify(moveMsg));
  };

  if (!isJoined) {
    return (
      <div className="app-container">
        <div className="card landing-card">
          <h1>4 in a Row</h1>
          <p style={{ color: 'var(--text-muted)' }}>Real-time multiplayer strategic game</p>
          <div className="input-group">
            <input
              type="text"
              placeholder="Enter your username..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && joinGame()}
            />
            <button onClick={joinGame}>Join Arena</button>
          </div>
        </div>

        <Leaderboard data={leaderboard} />
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="status-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <User size={20} color="var(--primary)" />
          <span style={{ fontWeight: 600 }}>{username}</span>
          <span style={{ color: 'var(--text-muted)' }}>vs</span>
          <span style={{ fontWeight: 600 }}>{opponent || '...'}</span>
        </div>

        {status === 'Playing' && (
          <div className={`turn-indicator ${gameState?.currentPlayer === 1 ? 'turn-red' : 'turn-yellow'}`}>
            {gameState?.currentPlayer === 1 ? "Red's Turn" : "Yellow's Turn"}
          </div>
        )}

        {status === 'Waiting' && <span>Finding Opponent...</span>}

        <button className="logout-btn" onClick={() => socketRef.current?.close()}
          style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--glass-border)' }}>
          <LogOut size={18} />
        </button>
      </div>

      <div className="game-layout">
        <div style={{ textAlign: 'center' }}>
          {status === 'Waiting' && (
            <div className="card">
              <div className="waiting-spinner"></div>
              <h3>Waiting for someone to join...</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Matching with a competitive bot in 10 seconds.</p>
            </div>
          )}

          {gameState && (
            <div className="board">
              {gameState.board.map((row, rIdx) =>
                row.map((cell, cIdx) => (
                  <div
                    key={`${rIdx}-${cIdx}`}
                    className={`cell ${cell === 1 ? 'player-1' : cell === 2 ? 'player-2' : ''}`}
                    onClick={() => makeMove(cIdx)}
                  ></div>
                ))
              )}
            </div>
          )}

          {status === 'Finished' && (
            <div className="card" style={{ marginTop: '2rem' }}>
              <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
                {gameState.isDraw ? "It's a Draw! 🤝" :
                  gameState.winner === 1 ? "Red Wins! 🎉" : "Yellow Wins! 🥳"}
              </h2>
              <button onClick={() => window.location.reload()}>Play Again</button>
            </div>
          )}
        </div>

        <Leaderboard data={leaderboard} />
      </div>
    </div>
  );
}

function Leaderboard({ data }) {
  return (
    <div className="card leaderboard-card" style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
        <Trophy color="gold" size={24} />
        <h2>Leaderboard</h2>
      </div>
      <div className="leader-list">
        {data.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No statistics yet</p>
        ) : (
          data.map((player, idx) => (
            <div key={idx} className="leader-item">
              <span>{idx + 1}. {player.username}</span>
              <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{player.wins} Wins</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
