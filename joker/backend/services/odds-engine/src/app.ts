import * as express from 'express';
import * as http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';
import { KafkaProducer } from '../../../shared/utils/kafka';

interface OddsData {
  eventId: string;
  sport: string;        
  homeTeam: string;
  awayTeam: string;
  odds: {
    home: number;
    away: number;
    draw?: number;
  };
  timestamp: Date;
}

class OddsEngine {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private redis: Redis;
  private kafkaProducer: KafkaProducer;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: { origin: "*" }
    });
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.kafkaProducer = new KafkaProducer();
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  private setupRoutes(): void {
    this.app.use(express.json());
    
    // Get current odds for an event
    this.app.get('/odds/:eventId', async (req, res) => {
      try {
        const eventId = req.params.eventId;
        const odds = await this.redis.get(`odds:${eventId}`);
        
        if (!odds) {
          return res.status(404).json({ error: 'Odds not found' });
        }
        
        res.json(JSON.parse(odds));
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Update odds (internal endpoint)
    this.app.post('/odds/update', async (req, res) => {
      try {
        const oddsData: OddsData = req.body;
        
        // Store in Redis for fast access
        await this.redis.setex(
          `odds:${oddsData.eventId}`, 
          300, // 5 minutes TTL
          JSON.stringify(oddsData)
        );
        
        // Broadcast to connected clients
        this.io.emit('odds-update', oddsData);
        
        // Send to Kafka for other services
        await this.kafkaProducer.send('odds-updates', oddsData);
        
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: 'Failed to update odds' });
      }
    });
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      
      socket.on('subscribe-event', (eventId: string) => {
        socket.join(`event:${eventId}`);
      });
      
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }

  public start(port: number = 8080): void {
    this.server.listen(port, () => {
      console.log(`Odds Engine running on port ${port}`);
    });
  }
}

const oddsEngine = new OddsEngine();
oddsEngine.start();