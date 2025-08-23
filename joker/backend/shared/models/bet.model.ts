export enum BetStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  WON = 'WON',
  LOST = 'LOST',
  VOID = 'VOID',
  CASHED_OUT = 'CASHED_OUT'
}

export enum BetType {
  SINGLE = 'SINGLE',
  MULTIPLE = 'MULTIPLE',
  SYSTEM = 'SYSTEM'
}

export interface Bet {
  id: string;
  userId: string;
  eventId: string;
  marketId: string;
  selectionId: string;
  betType: BetType;
  stake: number;
  odds: number;
  potentialPayout: number;
  status: BetStatus;
  placedAt: Date;
  settledAt?: Date;
  cashOutValue?: number;
  riskAssessment: {
    approved: boolean;
    riskScore: number;
    assessedAt: Date;
  };
}

export interface Event {
  id: string;
  sport: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  startTime: Date;
  status: 'UPCOMING' | 'LIVE' | 'FINISHED' | 'CANCELLED';
  markets: Market[];
}

export interface Market {
  id: string;
  eventId: string;
  name: string;
  type: string;
  selections: Selection[];
  status: 'OPEN' | 'SUSPENDED' | 'CLOSED';
}

export interface Selection {
  id: string;
  marketId: string;
  name: string;
  odds: number;
  status: 'ACTIVE' | 'SUSPENDED';
}