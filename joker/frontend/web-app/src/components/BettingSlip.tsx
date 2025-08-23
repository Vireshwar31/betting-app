import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

interface Bet {
  id: string;
  eventId: string;
  selection: string;
  odds: number;
  stake: number;
}

interface OddsUpdate {
  eventId: string;
  odds: {
    home: number;
    away: number;
    draw?: number;
  };
}

const BettingSlip: React.FC = () => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [totalStake, setTotalStake] = useState(0);
  const [potentialPayout, setPotentialPayout] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [userBalance, setUserBalance] = useState(0); // 🔴 INPUT NEEDED: User's wallet balance
  useEffect(() => {
    // 🔴 INPUT NEEDED: Replace with your actual WebSocket server URL
    const WEBSOCKET_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8080';
    
    const newSocket = io(WEBSOCKET_URL, {
      transports: ['websocket'],
      timeout: 5000,
    });
    
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to odds engine');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from odds engine');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
    });

    newSocket.on('odds-update', (data: OddsUpdate) => {
      // Update odds in real-time
      setBets(prevBets => 
        prevBets.map(bet => {
          if (bet.eventId === data.eventId) {
            // Update odds based on selection
            const selectionKey = bet.selection.toLowerCase() as keyof typeof data.odds;
            const newOdds = data.odds[selectionKey] || bet.odds;
            return { ...bet, odds: newOdds };
          }
          return bet;
        })
      );
    });

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    const stake = bets.reduce((sum, bet) => sum + bet.stake, 0);
    const payout = bets.reduce((sum, bet) => sum + (bet.stake * bet.odds), 0);
    setTotalStake(stake);
    setPotentialPayout(payout);
  }, [bets]);

  // 🔴 INPUT NEEDED: This function should be called when user selects a bet from the odds display
  const addBet = (eventId: string, selection: string, odds: number) => {
    // Check if bet already exists
    const existingBet = bets.find(bet => bet.eventId === eventId && bet.selection === selection);
    if (existingBet) {
      alert('This bet is already in your slip!');
      return;
    }

    const newBet: Bet = {
      id: `${eventId}-${selection}-${Date.now()}`,
      eventId,
      selection,
      odds,
      stake: 0
    };
    setBets(prevBets => [...prevBets, newBet]);
    
    // Subscribe to odds updates for this event
    if (socket && isConnected) {
      socket.emit('subscribe-event', eventId);
    }
  };

  const updateStake = (betId: string, stake: number) => {
    // Validate stake amount
    if (stake < 0) return;
    
    const maxStake = 10000; // 🔴 INPUT NEEDED: Set your platform's maximum stake limit
    const validatedStake = Math.min(stake, maxStake);
    
    setBets(prevBets => 
      prevBets.map(bet => 
        bet.id === betId ? { ...bet, stake: validatedStake } : bet
      )
    );
  };

  const removeBet = (betId: string) => {
    setBets(prevBets => prevBets.filter(bet => bet.id !== betId));
    
    // Unsubscribe from event if no more bets for that event
    const remainingBets = bets.filter(bet => bet.id !== betId);
    const removedBet = bets.find(bet => bet.id === betId);
    
    if (removedBet && socket && isConnected) {
      const hasOtherBetsForEvent = remainingBets.some(bet => bet.eventId === removedBet.eventId);
      if (!hasOtherBetsForEvent) {
        socket.emit('unsubscribe-event', removedBet.eventId);
      }
    }
  };

  const validateBets = (): string | null => {
    if (bets.length === 0) return 'No bets selected';
    
    const betsWithoutStake = bets.filter(bet => bet.stake <= 0);
    if (betsWithoutStake.length > 0) return 'Please enter stakes for all bets';
    
    if (totalStake > userBalance) return 'Insufficient balance';
    
    const minStake = 1; // 🔴 INPUT NEEDED: Set your platform's minimum stake
    const invalidStakes = bets.filter(bet => bet.stake < minStake);
    if (invalidStakes.length > 0) return `Minimum stake is $${minStake}`;
    
    return null;
  };

  const placeBets = async () => {
    const validationError = validateBets();
    if (validationError) {
      alert(validationError);
      return;
    }

    try {
      // 🔴 INPUT NEEDED: Replace with your actual API endpoint
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      
      const response = await fetch(`${API_BASE_URL}/api/bets/place`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}` // 🔴 INPUT NEEDED: Your auth token key
        },
        body: JSON.stringify({ 
          bets: bets.map(bet => ({
            eventId: bet.eventId,
            selection: bet.selection,
            odds: bet.odds,
            stake: bet.stake
          }))
        })
      });

      if (response.ok) {
        const result = await response.json();
        setBets([]);
        setUserBalance(prev => prev - totalStake); // Update balance
        alert(`Bets placed successfully! Bet IDs: ${result.betIds?.join(', ') || 'N/A'}`);
      } else {
        const error = await response.json();
        alert(`Error: ${error.message || 'Failed to place bets'}`);
      }
    } catch (error) {
      console.error('Bet placement error:', error);
      alert('Failed to place bets. Please check your connection.');
    }
  };

  // 🔴 INPUT NEEDED: Add function to fetch user balance
  const fetchUserBalance = async () => {
    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE_URL}/api/wallet/balance`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserBalance(data.balance);
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  };

  // Fetch balance on component mount
  useEffect(() => {
    fetchUserBalance();
  }, []);

  return (
    <div className="betting-slip">
      {/* Header with title and connection status */}
      <div className="betting-slip-header">
        <h3>Betting Slip</h3>
        <div className="connection-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Live' : '🔴 Offline'}
          </span>
        </div>
      </div>

      <div className="user-balance">
        <span>Balance: ${userBalance.toFixed(2)}</span>
        <button onClick={fetchUserBalance} className="refresh-balance">↻</button>
      </div>

      {bets.length === 0 ? (
        <div className="empty-slip">
          <p>No bets selected</p>
          <small>Click on odds to add bets to your slip</small>
        </div>
      ) : (
        <>
          <div className="bets-container">
            {bets.map((bet: Bet) => (
              <div key={bet.id} className="bet-item">
                {/* Remove button */}
                <div className="bet-header">
                  <button 
                    className="remove-bet" 
                    onClick={() => removeBet(bet.id)}
                    aria-label="Remove bet"
                  >
                    ✕
                  </button>
                </div>
                
                {/* Bet selection and odds */}
                <div className="bet-selection">
                  <span className="selection-name">{bet.selection}</span>
                  <span className="odds">{bet.odds.toFixed(2)}</span>
                </div>
                
                {/* Stake input */}
                <div className="stake-input-container">
                  <input
                    type="number"
                    placeholder="Stake ($)"
                    value={bet.stake || ''}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      updateStake(bet.id, value);
                    }}
                    min="1"
                    max="10000"
                    step="0.01"
                    className="stake-input"
                    onBlur={(e) => {
                      const value = parseFloat(e.target.value);
                      if (value && value >= 1) {
                        e.target.value = value.toFixed(2);
                      }
                    }}
                  />
                  {/* Potential win display */}
                  {bet.stake > 0 && (
                    <div className="potential-win">
                      Win: ${(bet.stake * bet.odds).toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="betting-summary">
            <div className="summary-row">
              <span>Total Stake:</span>
              <span>${totalStake.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>Potential Payout:</span>
              <span>${potentialPayout.toFixed(2)}</span>
            </div>
            <div className="summary-row profit">
              <span>Potential Profit:</span>
              <span>${(potentialPayout - totalStake).toFixed(2)}</span>
            </div>
          </div>

          <button
            className={`place-bets-btn ${totalStake === 0 || totalStake > userBalance ? 'disabled' : ''}`}
            onClick={placeBets}
            disabled={totalStake === 0 || totalStake > userBalance}
          >
            {totalStake > userBalance ? 'Insufficient Balance' : `Place Bets ($${totalStake.toFixed(2)})`}
          </button>
        </>
      )}
    </div>
  );
};

export default BettingSlip;