from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import redis
import json
from datetime import datetime, timedelta

app = FastAPI(title="Risk Management Service")
redis_client = redis.Redis(host='localhost', port=6379, db=0)

class BetRequest(BaseModel):
    user_id: str
    event_id: str
    bet_type: str
    stake: float
    odds: float
    potential_payout: float

class RiskAssessment(BaseModel):
    approved: bool
    risk_score: float
    max_stake: Optional[float]
    reason: Optional[str]

class RiskEngine:
    def __init__(self):
        self.max_single_bet = 10000  # $10,000
        self.max_daily_loss = 50000  # $50,000
        self.max_event_exposure = 100000  # $100,000
    
    async def assess_bet(self, bet: BetRequest) -> RiskAssessment:
        risk_score = 0.0
        reasons = []
        
        # Check user betting history
        user_daily_loss = await self.get_user_daily_loss(bet.user_id)
        if user_daily_loss + bet.stake > self.max_daily_loss:
            return RiskAssessment(
                approved=False,
                risk_score=1.0,
                reason="Daily loss limit exceeded"
            )
        
        # Check single bet limit
        if bet.stake > self.max_single_bet:
            return RiskAssessment(
                approved=False,
                risk_score=1.0,
                reason="Single bet limit exceeded"
            )
        
        # Check event exposure
        event_exposure = await self.get_event_exposure(bet.event_id)
        if event_exposure + bet.potential_payout > self.max_event_exposure:
            max_allowed_stake = (self.max_event_exposure - event_exposure) / bet.odds
            return RiskAssessment(
                approved=True,
                risk_score=0.8,
                max_stake=max_allowed_stake,
                reason="Event exposure limit approaching"
            )
        
        # Calculate risk score based on various factors
        risk_score = self.calculate_risk_score(bet)
        
        return RiskAssessment(
            approved=risk_score < 0.7,
            risk_score=risk_score
        )
    
    async def get_user_daily_loss(self, user_id: str) -> float:
        today = datetime.now().strftime('%Y-%m-%d')
        key = f"user_daily_loss:{user_id}:{today}"
        loss = redis_client.get(key)
        return float(loss) if loss else 0.0
    
    async def get_event_exposure(self, event_id: str) -> float:
        key = f"event_exposure:{event_id}"
        exposure = redis_client.get(key)
        return float(exposure) if exposure else 0.0
    
    def calculate_risk_score(self, bet: BetRequest) -> float:
        # Simplified risk scoring algorithm
        score = 0.0
        
        # High odds increase risk
        if bet.odds > 10.0:
            score += 0.3
        elif bet.odds > 5.0:
            score += 0.2
        
        # High stakes increase risk
        if bet.stake > 5000:
            score += 0.3
        elif bet.stake > 1000:
            score += 0.2
        
        return min(score, 1.0)

risk_engine = RiskEngine()

@app.post("/assess-bet", response_model=RiskAssessment)
async def assess_bet(bet: BetRequest):
    try:
        assessment = await risk_engine.assess_bet(bet)
        return assessment
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now()}